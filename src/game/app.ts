import { RIVALS, TRACK_VARIANTS, UPGRADE_DEFINITIONS } from "./content";
import { TurboVectorRuntime } from "./runtime";
import { ChampionshipManager } from "./simulation/championship";
import type {
  CareerResolution,
  PressureCallKey,
  RaceCompletion,
  RaceHudSnapshot,
  RaceSessionConfig,
  ScreenMode,
  TeamSetupKey,
  UpgradeKey,
} from "./types";

function formatTime(ms: number | null) {
  if (!ms) return "--";
  const totalSeconds = ms / 1000;
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toFixed(2).padStart(5, "0")}`;
}

function formatShortTime(ms: number | null) {
  if (!ms) return "--";
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCredits(value: number) {
  return `${value.toLocaleString()} cr`;
}

function formatPosition(position: number) {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

function formatTitleGap(points: number | null) {
  if (points === null) return "Open fight";
  if (points > 0) return `You +${points} pts`;
  if (points < 0) return `${Math.abs(points)} pts down`;
  return "Level on points";
}

function formatGapSwing(points: number | null) {
  if (points === null) return "No swing read";
  if (points > 0) return `Swing +${points} pts`;
  if (points < 0) return `Swing -${Math.abs(points)} pts`;
  return "Swing held";
}

function getSessionRivals(session: RaceSessionConfig) {
  return session.drivers
    .filter((driver) => !driver.isPlayer)
    .map((driver) => RIVALS.find((rival) => rival.id === driver.id))
    .filter((rival): rival is (typeof RIVALS)[number] => Boolean(rival));
}

function renderCrewAcademyChecklist() {
  return `
    <section class="tv-brief-section">
      <span class="tv-card__eyebrow">Crew academy</span>
      <h3>First-event checklist</h3>
      <div class="tv-brief-grid">
        <article class="tv-brief-card">
          <strong>Drive the opener clean</strong>
          <p>Throttle hard on the straights, breathe the brake into the cargo bends, and avoid turning the first race into a repair bill.</p>
        </article>
        <article class="tv-brief-card">
          <strong>Use the garage with intent</strong>
          <p>Condition carries forward. Repairs, upgrades, sponsor bonuses, and crew trim choices all start compounding after this event.</p>
        </article>
        <article class="tv-brief-card">
          <strong>Learn the names</strong>
          <p>Cass, Ivo, and the rest of the field are meant to feel like recurring rivals, not anonymous traffic. The season matters more if you remember who beat you.</p>
        </article>
      </div>
    </section>
  `;
}

function renderRivalDossier(session: RaceSessionConfig) {
  const rivals = getSessionRivals(session);
  if (rivals.length === 0) return "";

  return `
    <section class="tv-brief-section">
      <span class="tv-card__eyebrow">Rival dossier</span>
      <h3>Who matters in this event</h3>
      <div class="tv-dossier-grid">
        ${rivals
          .map(
            (rival) => `
              <article class="tv-dossier-card">
                <span class="tv-rival-chip" style="--driver-color:${rival.color}">${rival.callsign}</span>
                <strong>${rival.name}</strong>
                <p>${rival.description}</p>
                <span>${rival.style}</span>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPressureCallBrief(session: RaceSessionConfig) {
  if (!session.pressureCall) return "";

  return `
    <section class="tv-brief-section">
      <span class="tv-card__eyebrow">Championship call</span>
      <h3>${session.pressureCall.label}</h3>
      <div class="tv-brief-grid">
        <article class="tv-brief-card">
          <strong>Target rival</strong>
          <p>${session.pressureTargetName ?? "Whoever blinks first in the lead pack."}</p>
        </article>
        <article class="tv-brief-card">
          <strong>Effect</strong>
          <p>${session.pressureCall.effect}</p>
        </article>
        <article class="tv-brief-card">
          <strong>Why it matters</strong>
          <p>Late-season rounds should feel like a management call as much as a driving test. This move is part of the headline.</p>
        </article>
      </div>
    </section>
  `;
}

function renderPressureAftermathSection(resolution: CareerResolution) {
  const aftermath = resolution.pressureAftermath;
  if (!aftermath) return "";

  return `
    <div class="tv-garage-section tv-garage-section--pressure">
      <span class="tv-card__eyebrow">Aftermath report</span>
      <h3>${aftermath.reportHeadline}</h3>
      <p>${aftermath.reportSummary}</p>
      <div class="tv-kicker-grid">
        <div class="tv-kicker">
          <span>Rival beat</span>
          <strong>${aftermath.targetName ?? "Lead pack"}</strong>
        </div>
        <div class="tv-kicker">
          <span>Finish spread</span>
          <strong>${formatPosition(aftermath.playerFinishPosition)}${aftermath.targetFinishPosition ? ` // ${formatPosition(aftermath.targetFinishPosition)}` : ""}</strong>
        </div>
        <div class="tv-kicker">
          <span>Title fight</span>
          <strong>${formatTitleGap(aftermath.pointsGapBefore)} -> ${formatTitleGap(aftermath.pointsGapAfter)}</strong>
        </div>
        <div class="tv-kicker">
          <span>Standings swing</span>
          <strong>${formatGapSwing(aftermath.pointsGapSwing)}</strong>
        </div>
        <div class="tv-kicker">
          <span>Garage cash</span>
          <strong>${formatCredits(aftermath.creditsAfter)}</strong>
        </div>
        <div class="tv-kicker">
          <span>Shell state</span>
          <strong>${aftermath.conditionAfter}% ready</strong>
        </div>
        <div class="tv-kicker">
          <span>Next event</span>
          <strong>${aftermath.nextEventLabel}</strong>
        </div>
      </div>
      <div class="tv-note-banner tv-note-banner--compact">
        <span class="tv-note-banner__label">Crew recommendation</span>
        <strong>${aftermath.recommendation}</strong>
      </div>
    </div>
  `;
}

function renderCupSummaryAftermathSection(resolution: CareerResolution) {
  const aftermath = resolution.pressureAftermath;
  if (!aftermath) return "";

  return `
    <div class="tv-garage-section tv-garage-section--stacked tv-garage-section--pressure">
      <span class="tv-card__eyebrow">Final pressure ledger</span>
      <h3>${aftermath.reportHeadline}</h3>
      <p>${aftermath.reportSummary}</p>
      <div class="tv-mini-table">
        <div class="tv-mini-row">
          <span>Target rival</span>
          <strong>${aftermath.targetName ?? "Lead pack"}</strong>
        </div>
        <div class="tv-mini-row">
          <span>Finish spread</span>
          <strong>${formatPosition(aftermath.playerFinishPosition)}${aftermath.targetFinishPosition ? ` // ${formatPosition(aftermath.targetFinishPosition)}` : ""}</strong>
        </div>
        <div class="tv-mini-row">
          <span>Title gap</span>
          <strong>${formatTitleGap(aftermath.pointsGapBefore)} -> ${formatTitleGap(aftermath.pointsGapAfter)}</strong>
        </div>
        <div class="tv-mini-row">
          <span>Standings swing</span>
          <strong>${formatGapSwing(aftermath.pointsGapSwing)}</strong>
        </div>
        <div class="tv-mini-row">
          <span>Garage cash</span>
          <strong>${formatCredits(aftermath.creditsAfter)}</strong>
        </div>
        <div class="tv-mini-row">
          <span>Shell state</span>
          <strong>${aftermath.conditionAfter}% ready</strong>
        </div>
      </div>
      <div class="tv-note-banner tv-note-banner--compact">
        <span class="tv-note-banner__label">Crew recommendation</span>
        <strong>${aftermath.recommendation}</strong>
      </div>
    </div>
  `;
}

type ReviewSurface =
  | "menu"
  | "briefing"
  | "garage"
  | "race"
  | "results"
  | "standings"
  | "season-pressure"
  | "season-aftermath"
  | "season-recovery"
  | "season-summary";

function getReviewSurface(surface: string | undefined, autostart: boolean): ReviewSurface {
  if (
    surface === "menu" ||
    surface === "briefing" ||
    surface === "garage" ||
    surface === "race" ||
    surface === "results" ||
    surface === "standings" ||
    surface === "season-pressure" ||
    surface === "season-aftermath" ||
    surface === "season-recovery" ||
    surface === "season-summary"
  ) {
    return surface;
  }

  return autostart ? "race" : "menu";
}

function getReviewSurfaceLabel(surface: ReviewSurface) {
  if (surface === "menu") return "Menu reset";
  if (surface === "briefing") return "Opener briefing";
  if (surface === "garage") return "Pre-race garage";
  if (surface === "race") return "Round-one race";
  if (surface === "results") return "Post-race results";
  if (surface === "season-pressure") return "Late-season garage";
  if (surface === "season-aftermath") return "Late-season aftermath";
  if (surface === "season-recovery") return "Late-season recovery garage";
  if (surface === "season-summary") return "Season-complete cup summary";
  return "Post-race standings";
}

type TurboVectorAppOptions = {
  autostart?: boolean;
  reviewMode?: boolean;
  reviewSurface?: string;
};

export function createTurboVectorApp(root: HTMLElement, options: TurboVectorAppOptions = {}) {
  root.innerHTML = `
    <div class="tv-shell">
      <header class="tv-topbar">
        <div class="tv-brand">
          <span class="tv-eyebrow">Near-future arcade racing career build</span>
          <h1>Turbo Vector</h1>
          <p id="topbarSummary" class="tv-topbar__summary"></p>
        </div>
        <div id="topbarMeta" class="tv-topbar__meta"></div>
      </header>

      <main class="tv-layout">
        <section class="tv-stage-column">
          <div class="tv-stage-shell">
            <div id="game-root" class="tv-game-root" aria-label="Turbo Vector playable game canvas"></div>
            <div id="overlay-layer" class="tv-overlay-layer"></div>
          </div>
        </section>

        <aside class="tv-sidebar">
          <section id="sidebarPrimary" class="tv-card"></section>
          <section id="sidebarSecondary" class="tv-card"></section>
          <section id="sidebarTertiary" class="tv-card"></section>
        </aside>
      </main>

      <footer class="tv-footer">
        <span>Phase 2 web build: longer career, richer garage, stronger track identity</span>
        <span>South coast season foundation in active development</span>
      </footer>
    </div>
  `;

  const overlayLayer = root.querySelector<HTMLDivElement>("#overlay-layer")!;
  const gameRoot = root.querySelector<HTMLDivElement>("#game-root")!;
  const topbarSummary = root.querySelector<HTMLElement>("#topbarSummary")!;
  const topbarMeta = root.querySelector<HTMLElement>("#topbarMeta")!;
  const sidebarPrimary = root.querySelector<HTMLElement>("#sidebarPrimary")!;
  const sidebarSecondary = root.querySelector<HTMLElement>("#sidebarSecondary")!;
  const sidebarTertiary = root.querySelector<HTMLElement>("#sidebarTertiary")!;
  const reviewSurface = getReviewSurface(options.reviewSurface, Boolean(options.autostart));
  root.dataset.reviewMode = options.reviewMode ? "true" : "false";
  root.dataset.reviewSurface = options.reviewMode ? reviewSurface : "off";

  const manager = new ChampionshipManager({
    storageMode: options.reviewMode ? "memory" : "persistent",
    freshProfile: options.reviewMode,
  });
  const state = {
    screen: "menu" as ScreenMode,
    selectedVariantId: TRACK_VARIANTS[0].id,
    hud: null as RaceHudSnapshot | null,
    activeSession: null as RaceSessionConfig | null,
    pendingSession: null as RaceSessionConfig | null,
    completion: null as RaceCompletion | null,
    careerResolution: null as CareerResolution | null,
    notice: "",
  };

  let lastSidebarRefresh = 0;
  let raceHudRefs:
    | {
        title: HTMLElement;
        position: HTMLElement;
        lap: HTMLElement;
        speed: HTMLElement;
        condition: HTMLElement;
        boost: HTMLElement;
        best: HTMLElement;
        last: HTMLElement;
        objective: HTMLElement;
        tutorial: HTMLElement;
        damage: HTMLElement;
        hazard: HTMLElement;
        standings: HTMLElement;
      }
    | null = null;

  const runtime = new TurboVectorRuntime(gameRoot, {
    onHudUpdate: (snapshot) => {
      state.hud = snapshot;
      if (state.screen === "race" && snapshot) {
        updateRaceHud(snapshot);
        if (performance.now() - lastSidebarRefresh > 220) {
          renderSidebar();
          lastSidebarRefresh = performance.now();
        }
      }
    },
    onRaceComplete: (completion) => {
      if (completion.mode === "career") {
        state.careerResolution = manager.applyCareerResult(completion);
        state.completion = state.careerResolution.completion;
        state.notice = state.careerResolution.storyBeat;
      } else if (completion.mode === "timeTrial") {
        const recordSource = completion.playerResult.bestLapMs ?? completion.playerResult.finishTimeMs;
        const didSetRecord = recordSource ? manager.recordTimeTrial(completion.variantId, recordSource) : false;
        state.completion = {
          ...completion,
          didSetTimeTrialRecord: didSetRecord,
        };
        state.notice = didSetRecord
          ? "New time-trial record banked."
          : "Time trial complete. Keep chasing cleaner laps.";
      } else {
        state.completion = completion;
        state.notice = "Single event complete. Career season is where the full progression now lives.";
      }

      state.screen = "results";
      runtime.startGarageTheme();
      renderAll();
    },
    onRestartRequested: () => {
      if (state.activeSession) {
        launchSession(state.activeSession);
      }
    },
  });

  runtime.setAudioOptions(manager.getProfile().options);
  runtime.startSession(manager.createAttractSession());
  runtime.startMenuTheme();

  function renderAll() {
    root.dataset.screen = state.screen;
    renderTopbar();
    renderOverlay();
    renderSidebar();
  }

  function renderTopbar() {
    const profile = manager.getProfile();
    const currentHeat = manager.getCurrentHeat();
    const pressureAftermath = state.careerResolution?.pressureAftermath ?? null;
    const activeSponsor =
      state.screen === "results" && state.completion
        ? { name: state.completion.sponsorName }
        : state.activeSession?.activeSponsor ?? manager.getActiveSponsor();
    const selectedSetup =
      state.screen === "results" && state.completion
        ? { label: state.completion.setupLabel }
        : state.activeSession?.teamSetup ?? manager.getSelectedSetup();
    const completedCareerRoundLabel =
      state.screen === "results" && state.completion?.mode === "career" ? state.completion.subtitle : null;
    topbarSummary.textContent =
      state.screen === "race" && state.hud
        ? `${state.hud.title} // ${state.hud.subtitle}`
        : state.screen === "garage" && pressureAftermath
          ? `${pressureAftermath.reportHeadline} ${currentHeat?.name ?? "The next heat"} is next.`
        : state.screen === "results" && state.completion
          ? `${state.completion.title} closed under ${state.completion.weatherLabel.toLowerCase()}, and the garage now has to live with the result.`
          : currentHeat?.overview ?? "Build the Super Cars answer: rivals, garage economy, and one more championship momentum.";

    topbarMeta.innerHTML = `
      <div class="tv-chip">
        <span>Status</span>
        <strong>${completedCareerRoundLabel ?? manager.getCupProgressLabel()}</strong>
      </div>
      <div class="tv-chip">
        <span>Credits</span>
        <strong>${formatCredits(profile.credits)}</strong>
      </div>
      <div class="tv-chip">
        <span>Condition</span>
        <strong>${Math.round(profile.condition)}%</strong>
      </div>
      <div class="tv-chip">
        <span>Contract</span>
        <strong>${activeSponsor.name}</strong>
      </div>
      <div class="tv-chip">
        <span>Setup</span>
        <strong>${selectedSetup.label}</strong>
      </div>
      ${
        options.reviewMode
          ? `
            <div class="tv-chip">
              <span>Review</span>
              <strong>${getReviewSurfaceLabel(reviewSurface)}</strong>
            </div>
          `
          : ""
      }
      <div class="tv-chip tv-chip--notice">
        <span>Series</span>
        <strong>${state.notice || (currentHeat ? `${currentHeat.series} // ${currentHeat.weatherLabel}` : "Expanded career build in progress")}</strong>
      </div>
    `;
  }

  function renderMenuOverlay() {
    const profile = manager.getProfile();
    const activeLabel =
      profile.status === "active"
        ? "Continue Career"
        : profile.status === "completed"
          ? "Run Fresh Season"
          : "Start Career";

    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-hero-card">
          <p class="tv-eyebrow">Phase 2 career foundation</p>
          <h2>South coast career season</h2>
          <p>
            The web build now stretches beyond the rookie opener: multiple circuits, recurring rivals, sponsor
            contracts, weather-driven grip shifts, endurance pressure, showdown events, and a garage that has to
            sustain a full season rather than three isolated races.
          </p>
          <div class="tv-action-grid">
            <button class="tv-button" data-action="menu-career">${activeLabel}</button>
            <button class="tv-button tv-button--ghost" data-action="menu-single">Single Race</button>
            <button class="tv-button tv-button--ghost" data-action="menu-time-trial">Time Trial</button>
            <button class="tv-button tv-button--ghost" data-action="menu-garage">Garage</button>
            <button class="tv-button tv-button--ghost" data-action="menu-options">Options</button>
            <button class="tv-button tv-button--subtle" data-action="restart-career-fresh">Fresh Season</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function renderVariantSelection(mode: "singleRaceSelect" | "timeTrialSelect") {
    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-panel">
          <p class="tv-eyebrow">${mode === "singleRaceSelect" ? "Quick race" : "Solo run"}</p>
          <h2>${mode === "singleRaceSelect" ? "Choose an event" : "Choose a time-trial layout"}</h2>
          <div class="tv-variant-grid">
            ${TRACK_VARIANTS.map((variant) => `
              <button class="tv-variant-card ${state.selectedVariantId === variant.id ? "is-selected" : ""}" data-action="select-variant" data-variant-id="${variant.id}">
                <span class="tv-variant-card__tag">${variant.series} // ${variant.eventTypeLabel}</span>
                <strong>${variant.name}</strong>
                <span>${variant.location} // ${variant.weatherLabel}</span>
                <span>${variant.overview}</span>
                <span>${variant.laps} laps</span>
              </button>
            `).join("")}
          </div>
          <div class="tv-dialog-actions">
            <button class="tv-button" data-action="${mode === "singleRaceSelect" ? "launch-single" : "launch-time-trial"}">Launch</button>
            <button class="tv-button tv-button--ghost" data-action="return-menu">Back</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function renderBriefingOverlay(session: RaceSessionConfig) {
    const profile = manager.getProfile();
    const isFirstCareerBrief =
      session.mode === "career" && !profile.tutorialSeen && profile.history.length === 0;

    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-dialog tv-dialog--wide">
          <p class="tv-eyebrow">${session.subtitle}</p>
          <h2>${session.title}</h2>
          <p>${session.briefing}</p>
          <div class="tv-kicker-grid">
            <div class="tv-kicker">
              <span>Series</span>
              <strong>${session.variant.series}</strong>
            </div>
            <div class="tv-kicker">
              <span>Location</span>
              <strong>${session.variant.location}</strong>
            </div>
            <div class="tv-kicker">
              <span>Weather</span>
              <strong>${session.variant.weatherLabel}</strong>
            </div>
            <div class="tv-kicker">
              <span>Format</span>
              <strong>${session.variant.eventTypeLabel}</strong>
            </div>
            <div class="tv-kicker">
              <span>Contract</span>
              <strong>${session.activeSponsor.name}</strong>
            </div>
            <div class="tv-kicker">
              <span>Setup</span>
              <strong>${session.teamSetup.label}</strong>
            </div>
            <div class="tv-kicker">
              <span>Objective</span>
              <strong>${session.objective}</strong>
            </div>
            <div class="tv-kicker">
              <span>Prize ladder</span>
              <strong>${session.variant.purse.map((value, index) => `P${index + 1} ${formatCredits(value)}`).join(" / ")}</strong>
            </div>
            ${
              session.pressureCall
                ? `
                  <div class="tv-kicker">
                    <span>Championship call</span>
                    <strong>${session.pressureCall.label}</strong>
                  </div>
                `
                : ""
            }
          </div>
          <ul class="tv-bullet-list">
            ${session.variant.tutorialFocus.map((hint) => `<li>${hint}</li>`).join("")}
          </ul>
          ${isFirstCareerBrief ? renderCrewAcademyChecklist() : ""}
          ${renderPressureCallBrief(session)}
          ${renderRivalDossier(session)}
          <div class="tv-dialog-actions">
            <button class="tv-button" data-action="launch-briefing">Roll To Grid</button>
            <button class="tv-button tv-button--ghost" data-action="return-menu">Back</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function ensureRaceHud() {
    if (raceHudRefs) return;

    overlayLayer.innerHTML = `
      <div class="tv-race-hud">
        <div class="tv-hud-cluster tv-hud-cluster--primary">
          <div class="tv-hud-panel">
            <span class="tv-hud-label">Event</span>
            <strong id="hudTitle">--</strong>
            <span id="hudObjective" class="tv-hud-copy">--</span>
          </div>
          <div class="tv-hud-grid">
            <div class="tv-hud-stat"><span>Position</span><strong id="hudPosition">--</strong></div>
            <div class="tv-hud-stat"><span>Lap</span><strong id="hudLap">--</strong></div>
            <div class="tv-hud-stat"><span>Speed</span><strong id="hudSpeed">--</strong></div>
            <div class="tv-hud-stat"><span>Condition</span><strong id="hudCondition">--</strong></div>
            <div class="tv-hud-stat"><span>Boost</span><strong id="hudBoost">--</strong></div>
            <div class="tv-hud-stat"><span>Damage</span><strong id="hudDamage">--</strong></div>
            <div class="tv-hud-stat"><span>Best Lap</span><strong id="hudBest">--</strong></div>
            <div class="tv-hud-stat"><span>Last Lap</span><strong id="hudLast">--</strong></div>
          </div>
        </div>

        <div class="tv-hud-cluster tv-hud-cluster--secondary">
          <div class="tv-hud-panel">
            <span class="tv-hud-label">Crew Chief</span>
            <strong id="hudTutorial">Hold the line.</strong>
            <span id="hudHazard" class="tv-hud-copy">--</span>
          </div>
          <div class="tv-standings-panel">
            <span class="tv-hud-label">Running Order</span>
            <div id="hudStandings" class="tv-standings-list"></div>
          </div>
        </div>

        <div class="tv-touch-controls">
          <button class="tv-touch-button" data-touch-control="left" aria-label="Steer left">Left</button>
          <button class="tv-touch-button" data-touch-control="right" aria-label="Steer right">Right</button>
          <button class="tv-touch-button" data-touch-control="throttle" aria-label="Accelerate">Throttle</button>
          <button class="tv-touch-button" data-touch-control="brake" aria-label="Brake">Brake</button>
          <button class="tv-touch-button" data-touch-control="boost" aria-label="Boost">Boost</button>
        </div>

        <div class="tv-race-actions">
          <button class="tv-button tv-button--ghost" data-action="restart-current-session">Restart Event</button>
          <button class="tv-button tv-button--ghost" data-action="return-menu">Quit To Menu</button>
        </div>
      </div>
    `;

    raceHudRefs = {
      title: overlayLayer.querySelector<HTMLElement>("#hudTitle")!,
      position: overlayLayer.querySelector<HTMLElement>("#hudPosition")!,
      lap: overlayLayer.querySelector<HTMLElement>("#hudLap")!,
      speed: overlayLayer.querySelector<HTMLElement>("#hudSpeed")!,
      condition: overlayLayer.querySelector<HTMLElement>("#hudCondition")!,
      boost: overlayLayer.querySelector<HTMLElement>("#hudBoost")!,
      best: overlayLayer.querySelector<HTMLElement>("#hudBest")!,
      last: overlayLayer.querySelector<HTMLElement>("#hudLast")!,
      objective: overlayLayer.querySelector<HTMLElement>("#hudObjective")!,
      tutorial: overlayLayer.querySelector<HTMLElement>("#hudTutorial")!,
      damage: overlayLayer.querySelector<HTMLElement>("#hudDamage")!,
      hazard: overlayLayer.querySelector<HTMLElement>("#hudHazard")!,
      standings: overlayLayer.querySelector<HTMLElement>("#hudStandings")!,
    };

    runtime.bindTouchControls(overlayLayer);
  }

  function updateRaceHud(snapshot: RaceHudSnapshot) {
    ensureRaceHud();
    if (!raceHudRefs) return;

    raceHudRefs.title.textContent = `${snapshot.title} // ${snapshot.subtitle}`;
    raceHudRefs.position.textContent = `${snapshot.position} / ${snapshot.totalDrivers}`;
    raceHudRefs.lap.textContent = `${snapshot.lap} / ${snapshot.totalLaps}`;
    raceHudRefs.speed.textContent = `${snapshot.speedKph} km/h`;
    raceHudRefs.condition.textContent = `${snapshot.condition}%`;
    raceHudRefs.boost.textContent = `${snapshot.boost}%`;
    raceHudRefs.best.textContent = formatShortTime(snapshot.bestLapMs);
    raceHudRefs.last.textContent = formatShortTime(snapshot.lastLapMs);
    raceHudRefs.objective.textContent = snapshot.objective;
    raceHudRefs.tutorial.textContent = snapshot.tutorialHint ?? "Drive smooth and keep the shell alive.";
    raceHudRefs.damage.textContent = snapshot.damageLabel;
    raceHudRefs.hazard.textContent = snapshot.hazardNotes;
    raceHudRefs.standings.innerHTML = snapshot.standings
      .map(
        (entry) => `
          <div class="tv-standing-row ${entry.isPlayer ? "is-player" : ""}">
            <span class="tv-standing-rank">${entry.rank}</span>
            <span class="tv-standing-name" style="--driver-color:${entry.color}">${entry.name}</span>
            <span class="tv-standing-gap">${entry.gapLabel}</span>
          </div>
        `,
      )
      .join("");
  }

  function renderResultsOverlay() {
    const completion = state.completion;
    if (!completion) return;
    const contractOutcome = state.careerResolution?.contractOutcome ?? null;
    const pressureOutcome = state.careerResolution?.pressureOutcome ?? null;
    const pressureAftermath = state.careerResolution?.pressureAftermath ?? null;

    const primaryButton =
      completion.mode === "career"
        ? state.careerResolution?.cupFinished
          ? "Open Cup Summary"
          : "View Standings"
        : "Return To Menu";

    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-dialog tv-dialog--wide">
          <p class="tv-eyebrow">${completion.series} // ${completion.eventTypeLabel}</p>
          <h2>${completion.playerResult.finishPosition === 1 ? "Event Won" : `Finished P${completion.playerResult.finishPosition}`}</h2>
          <p>${state.notice}</p>
          <div class="tv-kicker-grid">
            <div class="tv-kicker">
              <span>Round</span>
              <strong>${completion.subtitle}</strong>
            </div>
            <div class="tv-kicker">
              <span>Weather</span>
              <strong>${completion.weatherLabel}</strong>
            </div>
            <div class="tv-kicker">
              <span>Setup</span>
              <strong>${completion.setupLabel}</strong>
            </div>
            <div class="tv-kicker">
              <span>Contract</span>
              <strong>${contractOutcome ? `${contractOutcome.sponsorName} ${contractOutcome.success ? `+${formatCredits(contractOutcome.bonusCredits)}` : "missed"}` : completion.sponsorName}</strong>
            </div>
            <div class="tv-kicker">
              <span>Prize</span>
              <strong>${formatCredits(completion.playerResult.purseAwarded)}</strong>
            </div>
            <div class="tv-kicker">
              <span>Condition</span>
              <strong>${completion.playerResult.condition}%</strong>
            </div>
            <div class="tv-kicker">
              <span>Best Lap</span>
              <strong>${formatShortTime(completion.playerResult.bestLapMs)}</strong>
            </div>
            ${
              pressureOutcome
                ? `
                  <div class="tv-kicker">
                    <span>Championship call</span>
                    <strong>${pressureOutcome.label}${pressureOutcome.bonusCredits > 0 ? ` // +${formatCredits(pressureOutcome.bonusCredits)}` : pressureOutcome.success ? " // landed" : " // missed"}</strong>
                  </div>
                `
                : ""
            }
          </div>
          ${
            pressureAftermath
              ? renderPressureAftermathSection(state.careerResolution as CareerResolution)
              : pressureOutcome
              ? `
                <div class="tv-note-banner">
                  <span class="tv-note-banner__label">Late-season call</span>
                  <strong>${pressureOutcome.summary}</strong>
                </div>
              `
              : ""
          }
          <div class="tv-results-table">
            ${completion.results
              .map(
                (result) => `
                  <div class="tv-results-row ${result.isPlayer ? "is-player" : ""}">
                    <span>P${result.finishPosition}</span>
                    <strong>${result.name}</strong>
                    <span>${formatTime(result.finishTimeMs)}</span>
                    <span>${formatShortTime(result.bestLapMs)}</span>
                    <span>${completion.mode === "career" ? `${result.pointsAwarded} pts` : result.isPlayer && completion.didSetTimeTrialRecord ? "Record" : "--"}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="tv-dialog-actions">
            <button class="tv-button" data-action="results-continue">${primaryButton}</button>
            <button class="tv-button tv-button--ghost" data-action="return-menu">Menu</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function renderStandingsOverlay() {
    const standings = manager.getStandingsTable();
    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-dialog tv-dialog--wide">
          <p class="tv-eyebrow">Season table</p>
          <h2>Career standings</h2>
          <div class="tv-results-table">
            ${standings
              .map(
                (entry, index) => `
                  <div class="tv-results-row ${entry.isPlayer ? "is-player" : ""}">
                    <span>${index + 1}</span>
                    <strong>${entry.name}</strong>
                    <span>${entry.points} pts</span>
                    <span>${formatCredits(entry.purse)}</span>
                    <span>${formatShortTime(entry.bestLapMs)}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
          <div class="tv-dialog-actions">
            <button class="tv-button" data-action="standings-continue">Continue To Garage</button>
            <button class="tv-button tv-button--ghost" data-action="return-menu">Menu</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function renderGarageOverlay() {
    const profile = manager.getProfile();
    const nextEvent = manager.getCurrentHeat();
    const quotes = manager.getRepairQuotes();
    const lastEvent = profile.history.length > 0 ? profile.history[profile.history.length - 1] : null;
    const pressureAftermath = state.careerResolution?.pressureAftermath ?? null;
    const activeSponsor = manager.getActiveSponsor();
    const availableSponsors = manager.getAvailableSponsors();
    const selectedSetup = manager.getSelectedSetup();
    const setupPlans = manager.getSetupPlans();
    const pressureCalls = manager.getAvailablePressureCalls();
    const activePressureCall = manager.getActivePressureCall();
    const pressureTarget = nextEvent ? manager.getPressureTarget(nextEvent.id) : manager.getPressureTarget();
    const playerStanding = profile.standings.find((entry) => entry.isPlayer) ?? null;
    const standingsLeader = profile.standings[0] ?? null;
    const rivalLeader = profile.standings.find((entry) => !entry.isPlayer) ?? null;
    const podium = profile.standings.slice(0, 3);
    const nextEventRivals = nextEvent
      ? RIVALS.filter((rival) => (nextEvent.fieldIds?.length ? nextEvent.fieldIds.includes(rival.id) : true)).slice(0, 3)
      : [];
    const isGarageOnboarding = !profile.tutorialSeen && profile.history.length === 0;
    const showPressureDesk = pressureCalls.length > 0 && Boolean(nextEvent);
    const requiresPressureDecision = showPressureDesk && !activePressureCall;
    const garageLeadCopy = pressureAftermath
      ? "The last title-fight call is banked. This next garage has to translate that swing into repairs, contract choices, and the next attack before the season slips again."
      : showPressureDesk
        ? "The season has tightened. Repairs and sponsor picks still matter, but now the garage also has to choose how to attack the title fight before the next grid."
        : "The garage now has to do more than fix damage. Line up a sponsor contract, choose the crew trim for the next event, and decide whether cash goes into pace, resilience, or simply surviving the back half of the season.";
    const garageRadioCopy =
      pressureAftermath?.recommendation ||
      state.notice ||
      (requiresPressureDecision
        ? `Late-season pressure is on. Pick the call for ${pressureTarget?.name ?? "the lead rival"} before rolling to grid.`
        : activePressureCall
          ? `${activePressureCall.label} is locked for ${nextEvent?.name ?? "the next event"}. ${pressureTarget?.name ?? "The lead rival"} is the name on the board.`
          : "The pit crew is waiting for your next call.");
    const pointsGapLabel =
      standingsLeader?.isPlayer || !standingsLeader || !playerStanding
        ? "You lead"
        : `${Math.max(0, standingsLeader.points - playerStanding.points)} pts down`;

    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-dialog tv-dialog--wide">
          ${
            showPressureDesk
              ? `
                <section class="tv-garage-section tv-garage-section--stacked tv-garage-section--pressure">
                  <span class="tv-card__eyebrow">Championship pressure</span>
                  <h3>${activePressureCall ? `${activePressureCall.label} loaded` : "Make the late-season call"}</h3>
                  <p>
                    This is the stronger management beat for the back half of the demo. Pick one move for ${nextEvent?.name ?? "the next event"} and let it tell the story of how the garage is chasing the title.
                  </p>
                  ${
                    pressureAftermath
                      ? `
                        <div class="tv-note-banner tv-note-banner--compact">
                          <span class="tv-note-banner__label">Last call fallout</span>
                          <strong>${pressureAftermath.reportHeadline}</strong>
                        </div>
                        <div class="tv-mini-table">
                          <div class="tv-mini-row"><span>Rival outcome</span><strong>${pressureAftermath.targetName ?? "Lead pack"} // ${pressureAftermath.targetFinishPosition ? formatPosition(pressureAftermath.targetFinishPosition) : "held"}</strong></div>
                          <div class="tv-mini-row"><span>Title swing</span><strong>${formatGapSwing(pressureAftermath.pointsGapSwing)}</strong></div>
                          <div class="tv-mini-row"><span>Table line</span><strong>${formatTitleGap(pressureAftermath.pointsGapAfter)}</strong></div>
                          <div class="tv-mini-row"><span>Next brief</span><strong>${pressureAftermath.nextEventLabel}</strong></div>
                        </div>
                      `
                      : ""
                  }
                  <div class="tv-mini-table">
                    <div class="tv-mini-row">
                      <span>Target rival</span>
                      <strong>${pressureTarget?.name ?? rivalLeader?.name ?? "Cass Vale"}</strong>
                    </div>
                    <div class="tv-mini-row">
                      <span>Table pressure</span>
                      <strong>${pointsGapLabel}</strong>
                    </div>
                    <div class="tv-mini-row">
                      <span>Garage wallet</span>
                      <strong>${formatCredits(profile.credits)}</strong>
                    </div>
                  </div>
                  <div class="tv-pressure-grid">
                    ${pressureCalls
                      .map((call) => {
                        const isSelected = activePressureCall?.key === call.key;
                        const isLocked = Boolean(activePressureCall) && !isSelected;
                        const tooExpensive = !isSelected && !activePressureCall && profile.credits < call.cost;
                        const buttonLabel = isSelected
                          ? "Locked In"
                          : isLocked
                            ? "Decision Locked"
                            : tooExpensive
                              ? `Need ${formatCredits(call.cost)}`
                              : call.cost > 0
                                ? `Commit ${formatCredits(call.cost)}`
                                : "Back This Call";

                        return `
                          <div class="tv-pressure-card ${isSelected ? "is-selected" : ""}">
                            <span class="tv-upgrade-level">${call.tag}</span>
                            <strong>${call.label}</strong>
                            <p>${call.summary}</p>
                            <div class="tv-pressure-meta">
                              <span>${call.effect}</span>
                              <span>${call.cost > 0 ? `Cost ${formatCredits(call.cost)}` : "No upfront cost"}</span>
                            </div>
                            <button class="tv-button ${isSelected ? "tv-button--subtle" : ""}" data-action="garage-select-pressure" data-pressure="${call.key}" ${isSelected || isLocked || tooExpensive ? "disabled" : ""}>
                              ${buttonLabel}
                            </button>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }

          <div class="tv-garage-hero">
            <div class="tv-garage-hero__main">
              <p class="tv-eyebrow">Garage</p>
              <h2>Southport pit unit</h2>
              <p>${garageLeadCopy}</p>
              <div class="tv-note-banner">
                <span class="tv-note-banner__label">Crew radio</span>
                <strong>${garageRadioCopy}</strong>
              </div>
              <div class="tv-kicker-grid">
                <div class="tv-kicker">
                  <span>Credits</span>
                  <strong>${formatCredits(profile.credits)}</strong>
                </div>
                <div class="tv-kicker">
                  <span>Condition</span>
                  <strong>${Math.round(profile.condition)}%</strong>
                </div>
                <div class="tv-kicker">
                  <span>Next event</span>
                  <strong>${nextEvent?.name ?? "Menu free run"}</strong>
                </div>
                <div class="tv-kicker">
                  <span>Contract</span>
                  <strong>${activeSponsor.name}</strong>
                </div>
                <div class="tv-kicker">
                  <span>Crew trim</span>
                  <strong>${selectedSetup.label}</strong>
                </div>
                <div class="tv-kicker">
                  <span>Event win purse</span>
                  <strong>${nextEvent ? formatCredits(nextEvent.purse[0] ?? 0) : "Free run"}</strong>
                </div>
                ${
                  pressureAftermath
                    ? `
                      <div class="tv-kicker">
                        <span>Last swing</span>
                        <strong>${formatGapSwing(pressureAftermath.pointsGapSwing)}</strong>
                      </div>
                    `
                    : ""
                }
                ${
                  showPressureDesk
                    ? `
                      <div class="tv-kicker">
                        <span>Championship call</span>
                        <strong>${activePressureCall?.label ?? "Decision pending"}</strong>
                      </div>
                    `
                    : ""
                }
              </div>
            </div>

            <aside class="tv-garage-hero__side">
              <span class="tv-card__eyebrow">Crew board</span>
              <h3>${lastEvent ? "Last event recap" : "Championship pulse"}</h3>
              ${
                lastEvent
                  ? `
                    <div class="tv-garage-log">
                      <div class="tv-garage-log__headline">
                        <strong>${lastEvent.title}</strong>
                        <span>${formatPosition(lastEvent.finishPosition)} finish</span>
                      </div>
                      <div class="tv-mini-table">
                        <div class="tv-mini-row"><span>Purse</span><strong>${formatCredits(lastEvent.purseEarned)}</strong></div>
                        <div class="tv-mini-row"><span>Contract</span><strong>${lastEvent.sponsorTargetHit ? `+${formatCredits(lastEvent.sponsorBonus)}` : "Missed"}</strong></div>
                        <div class="tv-mini-row"><span>Condition after</span><strong>${lastEvent.conditionAfter}%</strong></div>
                        <div class="tv-mini-row"><span>Best lap</span><strong>${formatShortTime(lastEvent.bestLapMs)}</strong></div>
                        ${
                          lastEvent.pressureCallLabel
                            ? `
                              <div class="tv-mini-row"><span>Pressure call</span><strong>${lastEvent.pressureCallLabel}${lastEvent.pressureBonusCredits > 0 ? ` // +${formatCredits(lastEvent.pressureBonusCredits)}` : lastEvent.pressureSucceeded ? " // landed" : " // missed"}</strong></div>
                              <div class="tv-mini-row"><span>Target rival</span><strong>${lastEvent.pressureTargetName ?? "Lead pack"}</strong></div>
                            `
                            : ""
                        }
                      </div>
                    </div>
                  `
                  : `
                    <p>The season has not started yet. The opener should teach the track, introduce the rivals, and make every repair bill feel real before the calendar widens.</p>
                  `
              }
              <div class="tv-mini-table">
                <div class="tv-mini-row">
                  <span>Rival to watch</span>
                  <strong>${rivalLeader?.name ?? "Cass Vale"}</strong>
                </div>
                <div class="tv-mini-row">
                  <span>Points gap</span>
                  <strong>${pointsGapLabel}</strong>
                </div>
              </div>
            </aside>
          </div>

          <div class="tv-garage-grid">
            <section class="tv-garage-section">
              <span class="tv-card__eyebrow">Service bay</span>
              <h3>Keep the shell alive</h3>
              <p>Damage is a strategic tax, not just visual noise. Repair enough to survive, then decide whether pace or protection matters more.</p>
              <ul class="tv-bullet-list">
                <li>${quotes.repairDiscount > 0 ? `${activeSponsor.name} is trimming repair quotes right now.` : "No active repair subsidy on the books."}</li>
                <li>Patch service is cheaper, but the finale is long enough that partial fixes can come back to bite.</li>
              </ul>
              <div class="tv-garage-actions">
                <button class="tv-button" data-action="garage-repair" data-kind="patch">Patch ${quotes.patchRestore}% for ${formatCredits(quotes.patchCost)}</button>
                <button class="tv-button tv-button--ghost" data-action="garage-repair" data-kind="full">Full Service ${quotes.fullRestore}% for ${formatCredits(quotes.fullCost)}</button>
              </div>
            </section>

            <section class="tv-garage-section">
              <span class="tv-card__eyebrow">Event plan</span>
              <h3>${nextEvent?.name ?? "Free run ready"}</h3>
              <p>${nextEvent?.briefing ?? "Use the garage to prep the car, then jump back into single races or time trials."}</p>
              <ul class="tv-bullet-list">
                <li>${nextEvent?.tutorialFocus[0] ?? "Engine upgrades pay off fastest when you can already keep the shell tidy."}</li>
                <li>Contract target: ${activeSponsor.objectiveLabel}</li>
                <li>Crew trim: ${selectedSetup.effect}</li>
                ${showPressureDesk ? `<li>Championship target: ${pressureTarget?.name ?? "Lead rival"} // ${pointsGapLabel}</li>` : ""}
              </ul>
            </section>
          </div>

          ${
            isGarageOnboarding
              ? `
                <section class="tv-garage-section tv-garage-section--stacked">
                  <span class="tv-card__eyebrow">Season onboarding</span>
                  <h3>What the first loop is teaching</h3>
                  <div class="tv-brief-grid">
                    <article class="tv-brief-card">
                      <strong>1. Finish with condition left</strong>
                      <p>The first result matters, but the bigger lesson is that damage now follows you into the next garage visit.</p>
                    </article>
                    <article class="tv-brief-card">
                      <strong>2. Spend with a purpose</strong>
                      <p>Repairs, upgrades, sponsor incentives, and crew trim choices should all feel like part of the same season economy.</p>
                    </article>
                    <article class="tv-brief-card">
                      <strong>3. Read the field</strong>
                      <p>The rivals below are the personalities the calendar wants you to remember from event to event.</p>
                    </article>
                  </div>
                </section>
              `
              : ""
          }

          <section class="tv-garage-section tv-garage-section--stacked">
            <span class="tv-card__eyebrow">Sponsor desk</span>
            <h3>Sign the next backing deal</h3>
            <p>Contracts give the season more texture: some cut repair pain, some cheapen upgrade pushes, and some only pay if the result matches the headline they want.</p>
            <div class="tv-contract-grid">
              ${availableSponsors
                .map(
                  (contract) => `
                    <div class="tv-contract-card ${contract.id === activeSponsor.id ? "is-selected" : ""}">
                      <span class="tv-upgrade-level">${contract.tag}</span>
                      <strong>${contract.name}</strong>
                      <p>${contract.summary}</p>
                      <div class="tv-contract-copy">
                        <span>${contract.objectiveLabel}</span>
                        <span>${contract.bonusLabel}</span>
                      </div>
                      <button class="tv-button ${contract.id === activeSponsor.id ? "tv-button--subtle" : ""}" data-action="garage-select-sponsor" data-sponsor="${contract.id}" ${contract.id === activeSponsor.id ? "disabled" : ""}>
                        ${contract.id === activeSponsor.id ? "Signed" : "Sign Contract"}
                      </button>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>

          <section class="tv-garage-section tv-garage-section--stacked">
            <span class="tv-card__eyebrow">Crew setup wall</span>
            <h3>Load the next trim</h3>
            <p>The team can bias the car before each event. Pick a trim that suits the venue instead of pretending one setup should solve the whole calendar.</p>
            <div class="tv-setup-grid">
              ${setupPlans
                .map(
                  (setup) => `
                    <div class="tv-setup-card ${setup.key === selectedSetup.key ? "is-selected" : ""}">
                      <span class="tv-upgrade-level">Crew trim</span>
                      <strong>${setup.label}</strong>
                      <p>${setup.summary}</p>
                      <span>${setup.effect}</span>
                      <button class="tv-button ${setup.key === selectedSetup.key ? "tv-button--subtle" : ""}" data-action="garage-select-setup" data-setup="${setup.key}" ${setup.key === selectedSetup.key ? "disabled" : ""}>
                        ${setup.key === selectedSetup.key ? "Loaded" : "Load Trim"}
                      </button>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>

          ${
            nextEventRivals.length > 0
              ? `
                <section class="tv-garage-section tv-garage-section--stacked">
                  <span class="tv-card__eyebrow">Rival board</span>
                  <h3>Watch these names next</h3>
                  <div class="tv-dossier-grid">
                    ${nextEventRivals
                      .map(
                        (rival) => `
                          <article class="tv-dossier-card">
                            <span class="tv-rival-chip" style="--driver-color:${rival.color}">${rival.callsign}</span>
                            <strong>${rival.name}</strong>
                            <p>${rival.description}</p>
                            <span>${rival.style}</span>
                          </article>
                        `,
                      )
                      .join("")}
                  </div>
                </section>
              `
              : ""
          }

          <div class="tv-upgrade-grid">
            ${UPGRADE_DEFINITIONS.map((upgrade) => {
              const level = profile.upgrades[upgrade.key];
              const nextCost = manager.getNextUpgradeCost(upgrade.key);
              return `
                <div class="tv-upgrade-card">
                  <span class="tv-upgrade-level">Level ${level}</span>
                  <strong>${upgrade.label}</strong>
                  <p>${upgrade.summary}</p>
                  <span>${upgrade.effect}</span>
                  <button class="tv-button ${nextCost ? "" : "tv-button--subtle"}" data-action="garage-upgrade" data-upgrade="${upgrade.key}" ${nextCost ? "" : "disabled"}>
                    ${nextCost ? `Upgrade for ${formatCredits(nextCost)}` : "Maxed this season"}
                  </button>
                </div>
              `;
            }).join("")}
          </div>

          <div class="tv-garage-section tv-garage-section--standings">
            <span class="tv-card__eyebrow">Podium watch</span>
            <h3>Current top three</h3>
            <div class="tv-mini-table">
              ${podium
                .map(
                  (entry, index) => `
                    <div class="tv-mini-row ${entry.isPlayer ? "is-player" : ""}">
                      <span>${index + 1}. ${entry.name}</span>
                      <strong>${entry.points} pts</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>

          <div class="tv-dialog-actions">
            <button class="tv-button" data-action="${profile.status === "active" && nextEvent ? "garage-continue" : "return-menu"}">${profile.status === "active" && nextEvent ? requiresPressureDecision ? "Lock A Call To Continue" : "To Next Event" : "Return To Menu"}</button>
            <button class="tv-button tv-button--ghost" data-action="return-menu">Menu</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function renderOptionsOverlay() {
    const options = manager.getProfile().options;
    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-dialog">
          <p class="tv-eyebrow">Options</p>
          <h2>Audio and comfort</h2>
          <div class="tv-option-list">
            <label class="tv-option-row">
              <span>Mute audio</span>
              <input type="checkbox" id="optMuted" ${options.muted ? "checked" : ""} />
            </label>
            <label class="tv-option-row">
              <span>Master volume</span>
              <input type="range" id="optMaster" min="0" max="1" step="0.01" value="${options.master}" />
            </label>
            <label class="tv-option-row">
              <span>Music volume</span>
              <input type="range" id="optMusic" min="0" max="1" step="0.01" value="${options.music}" />
            </label>
            <label class="tv-option-row">
              <span>SFX volume</span>
              <input type="range" id="optSfx" min="0" max="1" step="0.01" value="${options.sfx}" />
            </label>
          </div>
          <div class="tv-dialog-actions">
            <button class="tv-button" data-action="return-menu">Done</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function renderCupSummaryOverlay() {
    const profile = manager.getProfile();
    const careerResolution = state.careerResolution;
    overlayLayer.innerHTML = `
      <div class="tv-screen tv-screen--menu">
        <div class="tv-dialog tv-dialog--wide">
          <p class="tv-eyebrow">Career summary</p>
          <h2>Season complete</h2>
          <p>${state.notice}</p>
          <div class="tv-results-table">
            ${profile.standings
              .map(
                (entry, index) => `
                  <div class="tv-results-row ${entry.isPlayer ? "is-player" : ""}">
                    <span>${index + 1}</span>
                    <strong>${entry.name}</strong>
                    <span>${entry.points} pts</span>
                    <span>${formatCredits(entry.purse)}</span>
                    <span>${formatShortTime(entry.bestLapMs)}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
          ${careerResolution ? renderCupSummaryAftermathSection(careerResolution) : ""}
          <div class="tv-garage-section tv-garage-section--stacked">
            <span class="tv-card__eyebrow">Season dossier</span>
            <h3>How the calendar played out</h3>
            <div class="tv-mini-table">
              ${profile.history
                .map(
                  (event) => `
                    <div class="tv-mini-row">
                      <span>${event.subtitle} // ${event.setupLabel}</span>
                      <strong>${formatPosition(event.finishPosition)}${event.sponsorTargetHit ? ` // +${formatCredits(event.sponsorBonus)}` : ""}</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>
          <div class="tv-dialog-actions">
            <button class="tv-button" data-action="return-menu">Back To Menu</button>
            <button class="tv-button tv-button--ghost" data-action="restart-career-fresh">Run Fresh Season</button>
          </div>
        </div>
      </div>
    `;
    raceHudRefs = null;
  }

  function renderOverlay() {
    if (state.screen === "menu") return renderMenuOverlay();
    if (state.screen === "singleRaceSelect") return renderVariantSelection("singleRaceSelect");
    if (state.screen === "timeTrialSelect") return renderVariantSelection("timeTrialSelect");
    if (state.screen === "briefing" && state.pendingSession) return renderBriefingOverlay(state.pendingSession);
    if (state.screen === "race" && state.hud) return updateRaceHud(state.hud);
    if (state.screen === "results") return renderResultsOverlay();
    if (state.screen === "standings") return renderStandingsOverlay();
    if (state.screen === "garage") return renderGarageOverlay();
    if (state.screen === "options") return renderOptionsOverlay();
    if (state.screen === "cupSummary") return renderCupSummaryOverlay();
  }

  function renderSidebar() {
    const profile = manager.getProfile();
    const activeVariant = state.activeSession?.variant ?? TRACK_VARIANTS.find((variant) => variant.id === state.selectedVariantId) ?? TRACK_VARIANTS[0];
    const topRival = RIVALS.slice(0, 2);
    const nextEvent = manager.getCurrentHeat();
    const activeSponsor = state.activeSession?.activeSponsor ?? manager.getActiveSponsor();
    const selectedSetup = state.activeSession?.teamSetup ?? manager.getSelectedSetup();

    sidebarPrimary.innerHTML = `
      <p class="tv-card__eyebrow">${state.screen === "race" ? "Event brief" : "Studio brief"}</p>
      <h3>${state.screen === "race" ? activeVariant.name : "Manager handoff loaded"}</h3>
      <p>${state.screen === "race" ? activeVariant.heatTag : "Rebuild the shallow racer into a wider career: more circuits, more rival identity, more consequence, and more reasons to keep going."}</p>
      <ul class="tv-bullet-list">
        <li>Three circuit identities across a seven-round season</li>
        <li>Weather, hazards, and wear must matter between races</li>
        <li>The garage should still feel aspirational, not spreadsheet-heavy</li>
      </ul>
    `;

    sidebarSecondary.innerHTML = `
      <p class="tv-card__eyebrow">${state.screen === "garage" ? "Pit advice" : "Recurring rivals"}</p>
      <h3>${state.screen === "garage" ? "Contract and trim" : "Two names to remember"}</h3>
      ${state.screen === "garage"
        ? `
          <p>${nextEvent?.briefing ?? "Use the garage to set the car up, then head back to the cup."}</p>
          <ul class="tv-bullet-list">
            <li>${activeSponsor.name}: ${activeSponsor.objectiveLabel}</li>
            <li>${selectedSetup.label}: ${selectedSetup.effect}</li>
            <li>Patch the shell before shopping if condition is falling fast</li>
          </ul>
        `
        : topRival
            .map(
              (rival) => `
                <div class="tv-rival-card">
                  <span class="tv-rival-chip" style="--driver-color:${rival.color}">${rival.callsign}</span>
                  <strong>${rival.name}</strong>
                  <p>${rival.description}</p>
                </div>
              `,
            )
            .join("")}
    `;

    sidebarTertiary.innerHTML = `
      <p class="tv-card__eyebrow">${state.screen === "race" ? "Controls" : "Current build"}</p>
      <h3>${state.screen === "race" ? "Keep the loop readable" : "Garage state"}</h3>
      ${state.screen === "race"
        ? `
          <ul class="tv-bullet-list">
            <li>Throttle / Brake: Arrow keys or WASD</li>
            <li>Boost: Space or Shift once you have nitro</li>
            <li>Restart event: R or the HUD button</li>
          </ul>
        `
        : `
          <div class="tv-build-list">
            <div class="tv-build-row">
              <span>Contract</span>
              <strong>${activeSponsor.name}</strong>
            </div>
            <div class="tv-build-row">
              <span>Setup</span>
              <strong>${selectedSetup.label}</strong>
            </div>
            ${UPGRADE_DEFINITIONS.map(
              (upgrade) => `
                <div class="tv-build-row">
                  <span>${upgrade.shortLabel}</span>
                  <strong>Lv ${profile.upgrades[upgrade.key as UpgradeKey]}</strong>
                </div>
              `,
            ).join("")}
            <div class="tv-build-row">
              <span>Best trial</span>
              <strong>${formatShortTime(manager.getHeatRecord(activeVariant.id))}</strong>
            </div>
          </div>
        `}
    `;
  }

  function launchSession(session: RaceSessionConfig) {
    state.screen = "race";
    state.activeSession = session;
    state.pendingSession = null;
    state.completion = null;
    state.careerResolution = null;
    state.notice = "";
    runtime.startSession(session);
    renderAll();
  }

  function returnToMenu() {
    state.screen = "menu";
    state.activeSession = null;
    state.pendingSession = null;
    state.completion = null;
    state.careerResolution = null;
    state.hud = null;
    runtime.startSession(manager.createAttractSession());
    runtime.startMenuTheme();
    renderAll();
  }

  function clearOverlayState() {
    state.activeSession = null;
    state.pendingSession = null;
    state.completion = null;
    state.careerResolution = null;
    state.hud = null;
  }

  function loadReviewSurface(surface: ReviewSurface) {
    if (surface === "race") {
      const session = manager.restartCareerFromScratch();
      launchSession(session);
      state.notice = "Review mode // fresh round-one race loaded with no save writes.";
      renderTopbar();
      return;
    }

    if (surface === "briefing") {
      clearOverlayState();
      state.pendingSession = manager.restartCareerFromScratch();
      state.screen = "briefing";
      state.notice = "Review mode // rookie-cup briefing loaded from a fresh non-persistent season.";
      runtime.startMenuTheme();
      renderAll();
      return;
    }

    if (surface === "garage") {
      manager.restartCareerFromScratch();
      clearOverlayState();
      state.screen = "garage";
      state.notice = "Review mode // pre-race garage loaded from a fresh non-persistent season.";
      runtime.startGarageTheme();
      renderAll();
      return;
    }

    if (surface === "season-pressure") {
      manager.createReviewLateSeasonSession();
      clearOverlayState();
      state.screen = "garage";
      state.notice = "Review mode // late-season pressure garage loaded with a seeded title-fight state.";
      runtime.startGarageTheme();
      renderAll();
      return;
    }

    if (surface === "season-aftermath") {
      const reviewResolution = manager.createReviewLateSeasonResolution();
      clearOverlayState();
      state.completion = reviewResolution.completion;
      state.careerResolution = reviewResolution;
      state.screen = "results";
      state.notice = "Review mode // late-season pressure aftermath loaded from a seeded title-fight result.";
      runtime.startGarageTheme();
      renderAll();
      return;
    }

    if (surface === "season-recovery") {
      const reviewResolution = manager.createReviewLateSeasonResolution();
      clearOverlayState();
      state.completion = reviewResolution.completion;
      state.careerResolution = reviewResolution;
      state.screen = "garage";
      state.notice = "Review mode // late-season recovery garage loaded with authored fallout and next-grid management state.";
      runtime.startGarageTheme();
      renderAll();
      return;
    }

    if (surface === "season-summary") {
      const reviewResolution = manager.createReviewLateSeasonResolution();
      clearOverlayState();
      state.completion = reviewResolution.completion;
      state.careerResolution = reviewResolution;
      state.screen = "cupSummary";
      state.notice = "Review mode // season-complete cup summary loaded with the authored final pressure ledger.";
      runtime.startGarageTheme();
      renderAll();
      return;
    }

    const reviewResolution = manager.createReviewPostRaceResolution();
    clearOverlayState();
    state.completion = reviewResolution.completion;
    state.careerResolution = reviewResolution;
    state.screen = surface === "results" ? "results" : "standings";
    state.notice =
      surface === "results"
        ? "Review mode // deterministic post-race results loaded with no save writes."
        : "Review mode // deterministic post-race standings loaded with no save writes.";
    runtime.startGarageTheme();
    renderAll();
  }

  async function handleAction(action: string, actionElement: HTMLElement) {
    void runtime.primeAudio().catch(() => undefined);

    if (action === "menu-career") {
      runtime.playUiConfirm();
      runtime.startMenuTheme();
      state.pendingSession = manager.beginCareer();
      state.screen = "briefing";
      state.notice = "";
      renderAll();
      return;
    }

    if (action === "menu-single") {
      runtime.playUiConfirm();
      state.screen = "singleRaceSelect";
      renderAll();
      return;
    }

    if (action === "menu-time-trial") {
      runtime.playUiConfirm();
      state.screen = "timeTrialSelect";
      renderAll();
      return;
    }

    if (action === "menu-garage") {
      runtime.playUiConfirm();
      state.screen = "garage";
      runtime.startGarageTheme();
      renderAll();
      return;
    }

    if (action === "menu-options") {
      runtime.playUiConfirm();
      state.screen = "options";
      renderAll();
      return;
    }

    if (action === "restart-career-fresh") {
      runtime.playUiConfirm();
      state.pendingSession = manager.restartCareerFromScratch();
      state.screen = "briefing";
      state.notice = "Fresh career season prepared.";
      renderAll();
      return;
    }

    if (action === "select-variant") {
      const variantId = actionElement.dataset.variantId;
      if (variantId) {
        runtime.playUiConfirm();
        state.selectedVariantId = variantId;
        renderAll();
      }
      return;
    }

    if (action === "launch-briefing" && state.pendingSession) {
      runtime.playUiConfirm();
      launchSession(state.pendingSession);
      return;
    }

    if (action === "launch-single") {
      runtime.playUiConfirm();
      launchSession(manager.createSingleRaceSession(state.selectedVariantId));
      return;
    }

    if (action === "launch-time-trial") {
      runtime.playUiConfirm();
      launchSession(manager.createTimeTrialSession(state.selectedVariantId));
      return;
    }

    if (action === "garage-repair") {
      const kind = actionElement.dataset.kind === "full" ? "full" : "patch";
      const result = manager.repair(kind);
      if (result.ok) {
        runtime.playUiConfirm();
      } else {
        runtime.playUiBack();
      }
      state.notice = result.message;
      renderAll();
      return;
    }

    if (action === "garage-upgrade") {
      const key = actionElement.dataset.upgrade as UpgradeKey | undefined;
      if (key) {
        const result = manager.purchaseUpgrade(key);
        if (result.ok) {
          runtime.playUiConfirm();
        } else {
          runtime.playUiBack();
        }
        state.notice = result.message;
        renderAll();
      }
      return;
    }

    if (action === "garage-select-sponsor") {
      const sponsorId = actionElement.dataset.sponsor;
      if (sponsorId) {
        const result = manager.setActiveSponsor(sponsorId);
        if (result.ok) {
          runtime.playUiConfirm();
        } else {
          runtime.playUiBack();
        }
        state.notice = result.message;
        renderAll();
      }
      return;
    }

    if (action === "garage-select-setup") {
      const setupKey = actionElement.dataset.setup as TeamSetupKey | undefined;
      if (setupKey) {
        const result = manager.setTeamSetup(setupKey);
        if (result.ok) {
          runtime.playUiConfirm();
        } else {
          runtime.playUiBack();
        }
        state.notice = result.message;
        renderAll();
      }
      return;
    }

    if (action === "garage-select-pressure") {
      const pressureKey = actionElement.dataset.pressure as PressureCallKey | undefined;
      if (pressureKey) {
        const result = manager.setPressureCall(pressureKey);
        if (result.ok) {
          runtime.playUiConfirm();
        } else {
          runtime.playUiBack();
        }
        state.notice = result.message;
        renderAll();
      }
      return;
    }

    if (action === "garage-continue") {
      if (manager.getAvailablePressureCalls().length > 0 && !manager.getActivePressureCall()) {
        runtime.playUiBack();
        state.notice = "The late-season pressure desk is still open. Lock one championship call before heading to the grid.";
        renderAll();
        return;
      }
      runtime.playUiConfirm();
      state.pendingSession = manager.getCareerSession();
      state.screen = "briefing";
      renderAll();
      return;
    }

    if (action === "results-continue") {
      runtime.playUiConfirm();
      if (state.completion?.mode === "career") {
        state.screen = state.careerResolution?.cupFinished ? "cupSummary" : "standings";
      } else {
        returnToMenu();
      }
      renderAll();
      return;
    }

    if (action === "standings-continue") {
      runtime.playUiConfirm();
      state.screen = "garage";
      runtime.startGarageTheme();
      renderAll();
      return;
    }

    if (action === "restart-current-session" && state.activeSession) {
      runtime.playUiConfirm();
      launchSession(state.activeSession);
      return;
    }

    if (action === "return-menu") {
      runtime.playUiBack();
      returnToMenu();
    }
  }

  function handleOptionsInput() {
    if (state.screen !== "options") return;

    const muted = overlayLayer.querySelector<HTMLInputElement>("#optMuted")?.checked ?? false;
    const master = Number(overlayLayer.querySelector<HTMLInputElement>("#optMaster")?.value ?? "0.8");
    const music = Number(overlayLayer.querySelector<HTMLInputElement>("#optMusic")?.value ?? "0.62");
    const sfx = Number(overlayLayer.querySelector<HTMLInputElement>("#optSfx")?.value ?? "0.84");
    const options = { muted, master, music, sfx };
    manager.saveOptions(options);
    runtime.setAudioOptions(options);
    state.notice = muted ? "Audio muted." : "Audio mix updated.";
    renderTopbar();
  }

  root.addEventListener("click", (event) => {
    const actionElement = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!actionElement?.dataset.action) return;
    void handleAction(actionElement.dataset.action, actionElement);
  });

  root.addEventListener("input", () => {
    handleOptionsInput();
  });

  window.addEventListener("beforeunload", () => {
    runtime.destroy();
  });

  renderAll();

  if (options.reviewMode) {
    loadReviewSurface(reviewSurface);
    return;
  }

  if (options.autostart) {
    launchSession(manager.beginCareer());
  }
}
