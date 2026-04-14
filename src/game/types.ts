export type ScreenMode =
  | "menu"
  | "briefing"
  | "race"
  | "results"
  | "garage"
  | "standings"
  | "options"
  | "singleRaceSelect"
  | "timeTrialSelect"
  | "cupSummary";

export type RaceMode = "career" | "single" | "timeTrial" | "attract";
export type RaceEventType = "circuit" | "endurance" | "showdown";
export type AmbientPreset = "sunrise" | "golden" | "dusk";
export type UpgradeKey = "engine" | "tyres" | "brakes" | "armor" | "nitro";
export type TeamSetupKey = "balanced" | "attack" | "endurance" | "stability";
export type PressureCallKey = "night-shift" | "spotter-bribe" | "bonus-clause";
export type HazardType = "oil" | "barrier" | "boost";

export type Vector2 = {
  x: number;
  y: number;
};

export type CarUpgradeState = Record<UpgradeKey, number>;

export type AudioOptions = {
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
};

export type RivalProfile = {
  id: string;
  name: string;
  callsign: string;
  color: string;
  accent: string;
  carNumber: string;
  sponsor: string;
  style: string;
  description: string;
  skill: number;
  aggression: number;
  laneBias: number;
};

export type UpgradeDefinition = {
  key: UpgradeKey;
  label: string;
  shortLabel: string;
  summary: string;
  effect: string;
  costs: number[];
};

export type TeamSetupDefinition = {
  key: TeamSetupKey;
  label: string;
  summary: string;
  effect: string;
  maxSpeedDelta: number;
  accelerationDelta: number;
  brakeForceDelta: number;
  turnRateDelta: number;
  gripDelta: number;
  damageTakenMultiplier: number;
  wearFactor: number;
  boostCapacityDelta: number;
  boostForceDelta: number;
  boostRechargeDelta: number;
};

export type SponsorObjectiveDefinition = {
  requiredFinish: number;
  minCondition?: number;
  eventTypes?: RaceEventType[];
  locations?: string[];
  series?: string[];
};

export type SponsorContractDefinition = {
  id: string;
  name: string;
  tag: string;
  summary: string;
  objectiveLabel: string;
  bonusLabel: string;
  bonusCredits: number;
  unlockRound: number;
  repairDiscount?: number;
  upgradeDiscount?: number;
  objective: SponsorObjectiveDefinition;
};

export type SponsorContractOutcome = {
  sponsorId: string;
  sponsorName: string;
  success: boolean;
  bonusCredits: number;
  objectiveLabel: string;
  bonusLabel: string;
};

export type PressureCallDefinition = {
  key: PressureCallKey;
  label: string;
  tag: string;
  summary: string;
  effect: string;
  cost: number;
  unlockRound: number;
  tempUpgradeBoosts?: Partial<Record<UpgradeKey, number>>;
  rivalSkillDelta?: number;
  rivalAggressionDelta?: number;
  bonusCredits?: number;
  requiredFinish?: number;
};

export type PressureCallOutcome = {
  key: PressureCallKey;
  label: string;
  targetName: string | null;
  success: boolean;
  bonusCredits: number;
  summary: string;
};

export type PressureAftermath = {
  label: string;
  reportHeadline: string;
  reportSummary: string;
  targetName: string | null;
  playerFinishPosition: number;
  targetFinishPosition: number | null;
  pointsGapBefore: number | null;
  pointsGapAfter: number | null;
  pointsGapSwing: number | null;
  creditsAfter: number;
  conditionAfter: number;
  nextEventLabel: string;
  recommendation: string;
};

export type TrackHazard = {
  id: string;
  label: string;
  type: HazardType;
  position: Vector2;
  radius: number;
  intensity: number;
};

export type MarinaDecoration = {
  kind: "building" | "pier" | "palm" | "grandstand" | "yacht" | "tower" | "crane" | "lights";
  position: Vector2;
  width: number;
  height: number;
  tint?: string;
};

export type TrackVariant = {
  id: string;
  name: string;
  subtitle: string;
  series: string;
  location: string;
  weatherLabel: string;
  eventType: RaceEventType;
  eventTypeLabel: string;
  overview: string;
  briefing: string;
  objective: string;
  ambience: AmbientPreset;
  laps: number;
  width: number;
  purse: number[];
  centerline: Vector2[];
  hazards: TrackHazard[];
  hazardNotes: string;
  decorations: MarinaDecoration[];
  tutorialFocus: string[];
  heatTag: string;
  gripModifier: number;
  wearRate: number;
  fieldIds?: string[];
};

export type DriverStanding = {
  driverId: string;
  name: string;
  color: string;
  accent: string;
  carNumber: string;
  sponsor: string;
  points: number;
  purse: number;
  bestFinish: number;
  lastFinish: number | null;
  bestLapMs: number | null;
  isPlayer: boolean;
};

export type HeatHistory = {
  variantId: string;
  title: string;
  subtitle: string;
  series: string;
  location: string;
  weatherLabel: string;
  eventTypeLabel: string;
  setupLabel: string;
  sponsorName: string;
  sponsorBonus: number;
  sponsorTargetHit: boolean;
  purseEarned: number;
  finishPosition: number;
  conditionAfter: number;
  bestLapMs: number | null;
  pressureCallLabel: string | null;
  pressureTargetName: string | null;
  pressureBonusCredits: number;
  pressureSucceeded: boolean;
  results: RaceResultEntry[];
};

export type CareerStatus = "idle" | "active" | "completed";

export type PlayerProfile = {
  credits: number;
  condition: number;
  upgrades: CarUpgradeState;
  selectedSetup: TeamSetupKey;
  activeSponsorId: string;
  status: CareerStatus;
  currentHeatIndex: number;
  standings: DriverStanding[];
  history: HeatHistory[];
  bestTimeTrialMs: Record<string, number>;
  options: AudioOptions;
  tutorialSeen: boolean;
  activePressureCallKey: PressureCallKey | null;
  activePressureCallRound: number | null;
};

export type DriverGridEntry = {
  id: string;
  name: string;
  color: string;
  accent: string;
  carNumber: string;
  sponsor: string;
  isPlayer: boolean;
  skill: number;
  aggression: number;
  laneBias: number;
};

export type RaceSessionConfig = {
  mode: RaceMode;
  variant: TrackVariant;
  title: string;
  subtitle: string;
  briefing: string;
  objective: string;
  tutorialHints: string[];
  drivers: DriverGridEntry[];
  playerCondition: number;
  playerUpgrades: CarUpgradeState;
  playerCredits: number;
  teamSetup: TeamSetupDefinition;
  activeSponsor: SponsorContractDefinition;
  pressureCall: PressureCallDefinition | null;
  pressureTargetId: string | null;
  pressureTargetName: string | null;
  countdownEnabled: boolean;
};

export type ControlState = {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  restartPressed: boolean;
};

export type RaceEvent =
  | { type: "impact"; intensity: number }
  | { type: "lap"; lap: number; bestLapMs: number | null }
  | { type: "finish"; position: number }
  | { type: "boost" }
  | { type: "restart-requested" };

export type RenderCarSnapshot = {
  id: string;
  name: string;
  color: string;
  accent: string;
  isPlayer: boolean;
  x: number;
  y: number;
  heading: number;
  rank: number;
  condition: number;
  boosting: boolean;
  finished: boolean;
};

export type RaceRenderSnapshot = {
  variant: TrackVariant;
  cars: RenderCarSnapshot[];
  followTargetId: string;
  countdown: number;
};

export type HudStandingChip = {
  rank: number;
  name: string;
  color: string;
  isPlayer: boolean;
  gapLabel: string;
  finished: boolean;
};

export type RaceHudSnapshot = {
  mode: RaceMode;
  title: string;
  subtitle: string;
  objective: string;
  lap: number;
  totalLaps: number;
  position: number;
  totalDrivers: number;
  speedKph: number;
  condition: number;
  boost: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  elapsedMs: number;
  countdown: number;
  tutorialHint: string | null;
  standings: HudStandingChip[];
  credits: number;
  hazardNotes: string;
  damageLabel: string;
  boosting: boolean;
  offTrack: boolean;
};

export type RaceResultEntry = {
  driverId: string;
  name: string;
  color: string;
  accent: string;
  carNumber: string;
  sponsor: string;
  finishPosition: number;
  finishTimeMs: number | null;
  bestLapMs: number | null;
  pointsAwarded: number;
  purseAwarded: number;
  condition: number;
  isPlayer: boolean;
};

export type RaceCompletion = {
  mode: RaceMode;
  variantId: string;
  title: string;
  subtitle: string;
  series: string;
  location: string;
  weatherLabel: string;
  eventTypeLabel: string;
  setupLabel: string;
  sponsorName: string;
  pressureCallLabel: string | null;
  pressureTargetId: string | null;
  pressureTargetName: string | null;
  results: RaceResultEntry[];
  playerResult: RaceResultEntry;
  didSetTimeTrialRecord: boolean;
};

export type CareerResolution = {
  profile: PlayerProfile;
  completion: RaceCompletion;
  nextHeat: TrackVariant | null;
  cupFinished: boolean;
  totalPrize: number;
  contractOutcome: SponsorContractOutcome | null;
  pressureOutcome: PressureCallOutcome | null;
  pressureAftermath: PressureAftermath | null;
  storyBeat: string;
};
