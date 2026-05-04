import Phaser from "phaser";
import { crazyGameplayStart, crazyGameplayStop, crazyHappytime } from "../integrations/crazygames";
import { AudioManager } from "./audio/audioManager";
import { InputController } from "./input/controller";
import { BootScene } from "./phaser/scenes/BootScene";
import { RaceScene } from "./phaser/scenes/RaceScene";
import { RaceSimulation } from "./simulation/raceSimulation";
import type {
  AudioOptions,
  RaceCompletion,
  RaceHudSnapshot,
  RaceRenderSnapshot,
  RaceSessionConfig,
} from "./types";

type RuntimeCallbacks = {
  onHudUpdate: (snapshot: RaceHudSnapshot | null) => void;
  onRaceComplete: (completion: RaceCompletion) => void;
  onRestartRequested: () => void;
};

export class TurboVectorRuntime {
  private readonly callbacks: RuntimeCallbacks;
  private readonly mount: HTMLElement;
  private readonly input = new InputController();
  private readonly audio = new AudioManager();
  private readonly resizeObserver: ResizeObserver;
  private readonly raceScene: RaceScene;
  private readonly game: Phaser.Game;
  private activeSimulation: RaceSimulation | null = null;
  private activeConfig: RaceSessionConfig | null = null;
  private latestRenderSnapshot: RaceRenderSnapshot | null = null;
  private completionNotified = false;

  constructor(mount: HTMLElement, callbacks: RuntimeCallbacks) {
    this.mount = mount;
    this.callbacks = callbacks;
    this.raceScene = new RaceScene({
      advance: (deltaSeconds) => this.advance(deltaSeconds),
      getSnapshot: () => this.latestRenderSnapshot,
    });

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mount,
      width: mount.clientWidth || 1280,
      height: mount.clientHeight || 720,
      backgroundColor: "#071420",
      render: {
        antialias: true,
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: "100%",
        height: "100%",
      },
      scene: [new BootScene(), this.raceScene],
    });

    this.resizeObserver = new ResizeObserver(() => {
      const width = Math.max(720, mount.clientWidth);
      const height = Math.max(520, mount.clientHeight);
      this.game.scale.resize(width, height);
    });
    this.resizeObserver.observe(mount);
  }

  async primeAudio() {
    await this.audio.ensureStarted();
  }

  setAudioOptions(options: AudioOptions) {
    this.audio.setOptions(options);
  }

  getAudioOptions() {
    return this.audio.getOptions();
  }

  bindTouchControls(root: ParentNode) {
    root.querySelectorAll<HTMLElement>("[data-touch-control]").forEach((element) => {
      const action = element.dataset.touchControl;
      if (
        action === "left" ||
        action === "right" ||
        action === "throttle" ||
        action === "brake" ||
        action === "boost"
      ) {
        this.input.bindTouchButton(element, action);
      }
    });
  }

  startSession(config: RaceSessionConfig) {
    this.activeConfig = config;
    this.activeSimulation = new RaceSimulation(config);
    this.latestRenderSnapshot = this.activeSimulation.createRenderSnapshot();
    this.completionNotified = false;
    this.input.setEnabled(config.mode !== "attract");
    this.callbacks.onHudUpdate(this.activeSimulation.createHudSnapshot());
    this.audio.startTheme(config.mode === "career" || config.mode === "single" || config.mode === "timeTrial" ? "race" : "menu");
    if (config.mode === "career" || config.mode === "single" || config.mode === "timeTrial") {
      crazyGameplayStart();
    } else {
      crazyGameplayStop();
    }
  }

  startGarageTheme() {
    this.audio.startTheme("garage");
    crazyGameplayStop();
  }

  startMenuTheme() {
    this.audio.startTheme("menu");
    crazyGameplayStop();
  }

  playUiConfirm() {
    this.audio.playUiConfirm();
  }

  playUiBack() {
    this.audio.playUiBack();
  }

  private advance(deltaSeconds: number) {
    if (!this.activeSimulation || !this.activeConfig) {
      return;
    }

    this.activeSimulation.step(deltaSeconds, this.input.snapshot());
    this.input.endFrame();

    const hudSnapshot = this.activeSimulation.createHudSnapshot();
    this.latestRenderSnapshot = this.activeSimulation.createRenderSnapshot();
    this.callbacks.onHudUpdate(hudSnapshot);
    this.audio.updateEngine(hudSnapshot.speedKph, hudSnapshot.boosting, hudSnapshot.offTrack);

    this.activeSimulation.consumeEvents().forEach((event) => {
      if (event.type === "impact") this.audio.playImpact(event.intensity);
      if (event.type === "lap") this.audio.playLap();
      if (event.type === "finish") this.audio.playFinish(event.position);
      if (event.type === "boost") this.audio.playBoost();
      if (event.type === "restart-requested") this.callbacks.onRestartRequested();
    });

    const completion = this.activeSimulation.getCompletion();
    if (completion && !this.completionNotified) {
      this.completionNotified = true;
      crazyGameplayStop();
      // playerPosition === 1 means a podium top — fire happytime so CrazyGames
      // can register a positive engagement signal for ad pacing.
      if ((completion as { playerPosition?: number }).playerPosition === 1) {
        crazyHappytime();
      }
      this.callbacks.onRaceComplete(completion);
    }

    if (this.activeConfig.mode === "attract") {
      const playerCar = this.latestRenderSnapshot.cars.find((entry) => entry.isPlayer);
      if (playerCar?.finished) {
        this.startSession(this.activeConfig);
      }
    }
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.input.destroy();
    this.audio.destroy();
    this.game.destroy(true);
  }
}

