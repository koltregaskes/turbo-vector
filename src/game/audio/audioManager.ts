import { DEFAULT_AUDIO_OPTIONS } from "../content";
import type { AudioOptions } from "../types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type ThemeName = "menu" | "race" | "garage";

export class AudioManager {
  private context: AudioContext | null = null;
  private masterNode: GainNode | null = null;
  private musicNode: GainNode | null = null;
  private sfxNode: GainNode | null = null;
  private engineNode: GainNode | null = null;
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private themeTimer: number | null = null;
  private themeStep = 0;
  private activeTheme: ThemeName = "menu";
  private options: AudioOptions = { ...DEFAULT_AUDIO_OPTIONS };

  getOptions() {
    return { ...this.options };
  }

  setOptions(options: AudioOptions) {
    this.options = { ...options };
    if (!this.masterNode || !this.musicNode || !this.sfxNode) return;

    const masterVolume = options.muted ? 0 : clamp(options.master, 0, 1);
    this.masterNode.gain.setTargetAtTime(masterVolume, this.context!.currentTime, 0.02);
    this.musicNode.gain.setTargetAtTime(clamp(options.music, 0, 1) * 0.18, this.context!.currentTime, 0.03);
    this.sfxNode.gain.setTargetAtTime(clamp(options.sfx, 0, 1) * 0.25, this.context!.currentTime, 0.03);
  }

  async ensureStarted() {
    if (this.context) {
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
      return;
    }

    this.context = new AudioContext();
    this.masterNode = this.context.createGain();
    this.musicNode = this.context.createGain();
    this.sfxNode = this.context.createGain();
    this.engineNode = this.context.createGain();

    this.masterNode.connect(this.context.destination);
    this.musicNode.connect(this.masterNode);
    this.sfxNode.connect(this.masterNode);
    this.engineNode.connect(this.masterNode);

    this.engineOscA = this.context.createOscillator();
    this.engineOscA.type = "sawtooth";
    this.engineOscA.frequency.value = 92;
    this.engineOscA.connect(this.engineNode);
    this.engineOscA.start();

    this.engineOscB = this.context.createOscillator();
    this.engineOscB.type = "triangle";
    this.engineOscB.frequency.value = 46;
    this.engineOscB.connect(this.engineNode);
    this.engineOscB.start();

    this.engineNode.gain.value = 0.0001;
    this.setOptions(this.options);
    this.startTheme(this.activeTheme);
  }

  private playTone(frequency: number, durationSeconds: number, type: OscillatorType, volume: number, lane: "music" | "sfx") {
    if (!this.context || !this.musicNode || !this.sfxNode) return;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;

    oscillator.connect(gain);
    gain.connect(lane === "music" ? this.musicNode : this.sfxNode);

    const now = this.context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.04);
  }

  startTheme(theme: ThemeName) {
    this.activeTheme = theme;
    if (!this.context) return;

    if (this.themeTimer !== null) {
      window.clearInterval(this.themeTimer);
    }

    this.themeStep = 0;
    const sequence =
      theme === "race"
        ? [110, 146.8, 165, 220, 246.9, 220]
        : theme === "garage"
          ? [92.5, 110, 123.4, 146.8]
          : [82.4, 110, 138.6, 123.4];

    this.themeTimer = window.setInterval(() => {
      const note = sequence[this.themeStep % sequence.length];
      this.playTone(note, theme === "race" ? 0.22 : 0.28, theme === "race" ? "square" : "triangle", theme === "race" ? 0.1 : 0.08, "music");
      if (theme === "race" && this.themeStep % 2 === 0) {
        this.playTone(note * 0.5, 0.24, "sawtooth", 0.05, "music");
      }
      this.themeStep += 1;
    }, theme === "race" ? 230 : 300);
  }

  updateEngine(speedKph: number, boosting: boolean, offTrack: boolean) {
    if (!this.context || !this.engineNode || !this.engineOscA || !this.engineOscB) return;

    const speedRatio = clamp(speedKph / 320, 0, 1);
    const base = 82 + speedRatio * 168 + (boosting ? 24 : 0);
    this.engineOscA.frequency.setTargetAtTime(base, this.context.currentTime, 0.03);
    this.engineOscB.frequency.setTargetAtTime(base * 0.48, this.context.currentTime, 0.04);
    const gainTarget = speedKph < 4 ? 0.0001 : (offTrack ? 0.05 : 0.1) + speedRatio * 0.12;
    this.engineNode.gain.setTargetAtTime(gainTarget, this.context.currentTime, 0.03);
  }

  playUiConfirm() {
    this.playTone(440, 0.12, "square", 0.14, "sfx");
    this.playTone(659.3, 0.18, "triangle", 0.08, "sfx");
  }

  playUiBack() {
    this.playTone(220, 0.12, "triangle", 0.1, "sfx");
  }

  playImpact(intensity: number) {
    this.playTone(92 + intensity * 40, 0.12, "sawtooth", clamp(0.09 + intensity * 0.06, 0.08, 0.22), "sfx");
    this.playTone(180 + intensity * 70, 0.08, "square", 0.08, "sfx");
  }

  playLap() {
    this.playTone(523.3, 0.12, "triangle", 0.12, "sfx");
    this.playTone(659.3, 0.18, "triangle", 0.09, "sfx");
  }

  playFinish(position: number) {
    const note = position === 1 ? 783.99 : position <= 3 ? 659.3 : 523.3;
    this.playTone(note, 0.18, "square", 0.16, "sfx");
    this.playTone(note * 1.25, 0.26, "triangle", 0.1, "sfx");
  }

  playBoost() {
    this.playTone(310, 0.1, "sawtooth", 0.12, "sfx");
  }

  destroy() {
    if (this.themeTimer !== null) {
      window.clearInterval(this.themeTimer);
    }

    this.engineOscA?.stop();
    this.engineOscB?.stop();
    this.context?.close();
    this.context = null;
  }
}
