import {
  PRESSURE_CALLS,
  POINTS_TABLE,
  RIVALS,
  SPONSOR_CONTRACTS,
  TEAM_SETUPS,
  TRACK_VARIANTS,
  UPGRADE_DEFINITIONS,
  createInitialProfile,
  createInitialStandings,
  getPressureCallByKey,
  getSponsorContractById,
  getTeamSetupByKey,
  getVariantById,
} from "../content";
import type {
  AudioOptions,
  CareerResolution,
  DriverGridEntry,
  DriverStanding,
  PlayerProfile,
  PressureAftermath,
  PressureCallDefinition,
  PressureCallOutcome,
  PressureCallKey,
  RaceCompletion,
  RaceSessionConfig,
  SponsorContractDefinition,
  SponsorContractOutcome,
  TeamSetupKey,
  TrackVariant,
  UpgradeKey,
} from "../types";

const STORAGE_KEY = "turbo-vector-profile-v2";

type ChampionshipManagerOptions = {
  storageMode?: "persistent" | "memory";
  freshProfile?: boolean;
};

function cloneProfile(profile: PlayerProfile): PlayerProfile {
  return JSON.parse(JSON.stringify(profile)) as PlayerProfile;
}

function sortStandings(profile: PlayerProfile) {
  profile.standings.sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (left.bestFinish !== right.bestFinish) return left.bestFinish - right.bestFinish;
    if ((left.lastFinish ?? 99) !== (right.lastFinish ?? 99)) return (left.lastFinish ?? 99) - (right.lastFinish ?? 99);
    if (right.purse !== left.purse) return right.purse - left.purse;
    return left.name.localeCompare(right.name);
  });
}

function mergeStandings(parsedStandings: DriverStanding[] | undefined) {
  const defaults = createInitialStandings();
  return defaults.map((entry) => ({
    ...entry,
    ...(parsedStandings?.find((candidate) => candidate.driverId === entry.driverId) ?? {}),
  }));
}

function getAvailableSponsorsForIndex(roundIndex: number) {
  return SPONSOR_CONTRACTS.filter((contract) => roundIndex >= contract.unlockRound);
}

function getSafeActiveSponsorId(contractId: string | undefined, roundIndex: number) {
  const available = getAvailableSponsorsForIndex(roundIndex);
  return available.find((contract) => contract.id === contractId)?.id ?? available[0]?.id ?? SPONSOR_CONTRACTS[0].id;
}

function getAvailablePressureCallsForIndex(roundIndex: number) {
  return PRESSURE_CALLS.filter((call) => roundIndex >= call.unlockRound);
}

function getSafeActivePressureCallKey(callKey: PressureCallKey | null | undefined, roundIndex: number) {
  const available = getAvailablePressureCallsForIndex(roundIndex);
  return available.find((call) => call.key === callKey)?.key ?? null;
}

function evaluateSponsorContract(contract: SponsorContractDefinition, completion: RaceCompletion): SponsorContractOutcome {
  const objective = contract.objective;
  const variant = getVariantById(completion.variantId);
  const finishOk = completion.playerResult.finishPosition <= objective.requiredFinish;
  const conditionOk = objective.minCondition === undefined || completion.playerResult.condition >= objective.minCondition;
  const eventOk = !objective.eventTypes || objective.eventTypes.includes(variant.eventType);
  const locationOk = !objective.locations || objective.locations.includes(completion.location);
  const seriesOk = !objective.series || objective.series.includes(completion.series);
  const success = finishOk && conditionOk && eventOk && locationOk && seriesOk;

  return {
    sponsorId: contract.id,
    sponsorName: contract.name,
    success,
    bonusCredits: success ? contract.bonusCredits : 0,
    objectiveLabel: contract.objectiveLabel,
    bonusLabel: contract.bonusLabel,
  };
}

function evaluatePressureCall(call: PressureCallDefinition, completion: RaceCompletion): PressureCallOutcome {
  const targetResult = completion.pressureTargetId
    ? completion.results.find((result) => result.driverId === completion.pressureTargetId)
    : null;
  const targetName = completion.pressureTargetName ?? targetResult?.name ?? null;

  if (call.key === "bonus-clause") {
    const finishOk = completion.playerResult.finishPosition <= (call.requiredFinish ?? 3);
    const rivalOk = targetResult ? completion.playerResult.finishPosition < targetResult.finishPosition : true;
    const success = finishOk && rivalOk;
    return {
      key: call.key,
      label: call.label,
      targetName,
      success,
      bonusCredits: success ? call.bonusCredits ?? 0 : 0,
      summary: success
        ? `The bonus clause landed. ${targetName ?? "The target rival"} stayed behind you, so the sponsor desk pays out.`
        : `The bonus clause missed. ${targetName ?? "The target rival"} or the podium line got away from you, so the garage gets no extra cash.`,
    };
  }

  if (call.key === "spotter-bribe") {
    const success = targetResult ? completion.playerResult.finishPosition < targetResult.finishPosition : completion.playerResult.finishPosition <= 4;
    return {
      key: call.key,
      label: call.label,
      targetName,
      success,
      bonusCredits: 0,
      summary: success
        ? `${targetName ?? "The target rival"} never fully settled after the bribe, and you turned that wobble into track position.`
        : `${targetName ?? "The target rival"} weathered the spotter trick, so the move bought tension more than outright advantage.`,
    };
  }

  const success = completion.playerResult.finishPosition <= 3;
  return {
    key: call.key,
    label: call.label,
    targetName,
    success,
    bonusCredits: 0,
    summary: success
      ? "The night-shift overclock translated into a real result instead of a desperate late-season spend."
      : "The night-shift overclock gave the car more shove, but the result still left work for the garage.",
  };
}

function loadProfile(): PlayerProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialProfile();
    }

    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const profile = createInitialProfile();
    const standings = mergeStandings(parsed.standings);
    const currentHeatIndex = Math.max(0, Math.min(parsed.currentHeatIndex ?? 0, TRACK_VARIANTS.length));
    const migratedStatus =
      currentHeatIndex >= TRACK_VARIANTS.length
        ? "completed"
        : parsed.status === "completed" && currentHeatIndex < TRACK_VARIANTS.length
          ? "active"
          : (parsed.status ?? profile.status);
    const defaultSetup = getTeamSetupByKey(parsed.selectedSetup ?? profile.selectedSetup);
    const defaultSponsor = getSponsorContractById(parsed.activeSponsorId ?? profile.activeSponsorId);
    const activePressureCallKey = getSafeActivePressureCallKey(
      parsed.activePressureCallKey ?? profile.activePressureCallKey,
      currentHeatIndex,
    );
    const activePressureCall = getPressureCallByKey(activePressureCallKey);
    const history = (parsed.history ?? []).map((entry) => {
      const variant = getVariantById(entry.variantId ?? TRACK_VARIANTS[0].id);
      return {
        variantId: entry.variantId ?? variant.id,
        title: entry.title ?? variant.name,
        subtitle: entry.subtitle ?? variant.subtitle,
        series: entry.series ?? variant.series,
        location: entry.location ?? variant.location,
        weatherLabel: entry.weatherLabel ?? variant.weatherLabel,
        eventTypeLabel: entry.eventTypeLabel ?? variant.eventTypeLabel,
        setupLabel: entry.setupLabel ?? defaultSetup.label,
        sponsorName: entry.sponsorName ?? defaultSponsor.name,
        sponsorBonus: entry.sponsorBonus ?? 0,
        sponsorTargetHit: entry.sponsorTargetHit ?? false,
        purseEarned: entry.purseEarned ?? 0,
        finishPosition: entry.finishPosition ?? 7,
        conditionAfter: entry.conditionAfter ?? profile.condition,
        bestLapMs: entry.bestLapMs ?? null,
        pressureCallLabel: entry.pressureCallLabel ?? activePressureCall?.label ?? null,
        pressureTargetName: entry.pressureTargetName ?? null,
        pressureBonusCredits: entry.pressureBonusCredits ?? 0,
        pressureSucceeded: entry.pressureSucceeded ?? false,
        results: entry.results ?? [],
      };
    });

    return {
      ...profile,
      ...parsed,
      currentHeatIndex,
      status: migratedStatus,
      upgrades: { ...profile.upgrades, ...(parsed.upgrades ?? {}) },
      selectedSetup: getTeamSetupByKey(parsed.selectedSetup ?? profile.selectedSetup).key,
      activeSponsorId: getSafeActiveSponsorId(parsed.activeSponsorId ?? profile.activeSponsorId, currentHeatIndex),
      options: { ...profile.options, ...(parsed.options ?? {}) },
      standings,
      history,
      bestTimeTrialMs: parsed.bestTimeTrialMs ?? {},
      activePressureCallKey,
      activePressureCallRound:
        activePressureCallKey && parsed.activePressureCallRound === currentHeatIndex ? currentHeatIndex : null,
    };
  } catch {
    return createInitialProfile();
  }
}

function createDriverGrid(variant: TrackVariant, includeRivals: boolean): DriverGridEntry[] {
  const grid: DriverGridEntry[] = [
    {
      id: "player",
      name: "You",
      color: "#ff8454",
      accent: "#ffe3c9",
      carNumber: "01",
      sponsor: "Vector Works",
      isPlayer: true,
      skill: 0.82,
      aggression: 0.72,
      laneBias: 0,
    },
  ];

  if (!includeRivals) {
    return grid;
  }

  const rivalPool = variant.fieldIds?.length
    ? RIVALS.filter((rival) => variant.fieldIds?.includes(rival.id))
    : RIVALS;

  return [
    ...grid,
    ...rivalPool.map((rival) => ({
      id: rival.id,
      name: rival.name,
      color: rival.color,
      accent: rival.accent,
      carNumber: rival.carNumber,
      sponsor: rival.sponsor,
      isPlayer: false,
      skill: rival.skill,
      aggression: rival.aggression,
      laneBias: rival.laneBias,
    })),
  ];
}

function buildStoryBeat(
  completion: RaceCompletion,
  roundIndex: number,
  careerFinished: boolean,
  contractOutcome: SponsorContractOutcome | null,
  pressureOutcome: PressureCallOutcome | null,
) {
  let baseMessage = "";

  if (careerFinished) {
    if (completion.playerResult.finishPosition === 1) {
      baseMessage =
        "You finish the seven-round season with a car that earned its upgrades and a field that finally feels like a real commercial racer instead of a sketch.";
    } else if (completion.playerResult.finishPosition <= 3) {
      baseMessage =
        "You close the season with a credible podium run and enough momentum that the next full-career build can go bigger without changing the fantasy.";
    } else {
      baseMessage =
        "You survive the season more than you dominate it, which is still useful: the progression loop now has enough weight to support a full-game career.";
    }
  } else if (completion.eventTypeLabel === "Showdown") {
    baseMessage =
      "The smaller-field showdown proves the career can do more than one race format without abandoning the handling model.";
  } else if (completion.eventTypeLabel.toLowerCase().includes("endurance")) {
    baseMessage =
      "The longer-distance round makes wear, repairs, and weather feel like systems instead of surface dressing.";
  } else if (roundIndex === 0) {
    baseMessage =
      "The season opener still teaches the fantasy cleanly, but now it points into something much larger than a short opener.";
  } else {
    baseMessage =
      "The calendar keeps widening. Every garage visit should feel more like season management and less like a between-race menu.";
  }

  let finalMessage = baseMessage;

  if (contractOutcome) {
    finalMessage = contractOutcome.success
      ? `${finalMessage} ${contractOutcome.sponsorName} pays out, which gives the garage another layer of real season pressure.`
      : `${finalMessage} ${contractOutcome.sponsorName} leaves the contract bonus on the table, so the next garage decision matters a little more.`;
  }

  if (!pressureOutcome) {
    return finalMessage;
  }

  return pressureOutcome.success
    ? `${finalMessage} ${pressureOutcome.summary}`
    : `${finalMessage} ${pressureOutcome.summary}`;
}

type ReviewCompletionOptions = {
  playerFinishPosition?: number;
  playerCondition?: number;
  fixedPlacements?: Partial<Record<string, number>>;
};

function createDeterministicReviewCompletion(
  session: RaceSessionConfig,
  options: ReviewCompletionOptions = {},
): RaceCompletion {
  const player = session.drivers.find((driver) => driver.isPlayer) ?? session.drivers[0];
  const playerFinishPosition = Math.max(1, Math.min(options.playerFinishPosition ?? 3, session.drivers.length));
  const fixedPlacements = Object.entries(options.fixedPlacements ?? {}).reduce(
    (map, [driverId, position]) => {
      if (typeof position !== "number") return map;
      const clamped = Math.max(1, Math.min(session.drivers.length, Math.round(position)));
      map.set(driverId, clamped);
      return map;
    },
    new Map<string, number>([[player.id, playerFinishPosition]]),
  );
  const orderedDrivers: DriverGridEntry[] = [];
  const assignedDriverIds = new Set<string>();

  for (let index = 1; index <= session.drivers.length; index += 1) {
    const fixedDriver = session.drivers.find((driver) => fixedPlacements.get(driver.id) === index && !assignedDriverIds.has(driver.id));
    if (fixedDriver) {
      orderedDrivers.push(fixedDriver);
      assignedDriverIds.add(fixedDriver.id);
      continue;
    }

    const nextDriver = session.drivers.find((driver) => !assignedDriverIds.has(driver.id));
    if (nextDriver) {
      orderedDrivers.push(nextDriver);
      assignedDriverIds.add(nextDriver.id);
    }
  }

  const isEnduranceRound = session.variant.eventType === "endurance";
  const baseFinishTime = isEnduranceRound ? 176_400 : 93_600;
  const finishDelta = isEnduranceRound ? 3_150 : 1_780;
  const baseBestLap = isEnduranceRound ? 27_900 : 18_600;
  const bestLapDelta = isEnduranceRound ? 390 : 240;

  const results = orderedDrivers.map((driver, index) => {
    const finishPosition = index + 1;
    const bestLapMs = baseBestLap + index * bestLapDelta;
    const finishTimeMs = baseFinishTime + index * finishDelta;
    const isPlayer = driver.isPlayer;

    return {
      driverId: driver.id,
      name: driver.name,
      color: driver.color,
      accent: driver.accent,
      carNumber: driver.carNumber,
      sponsor: driver.sponsor,
      finishPosition,
      finishTimeMs,
      bestLapMs,
      pointsAwarded: POINTS_TABLE[index] ?? 0,
      purseAwarded: session.variant.purse[index] ?? 0,
      condition: isPlayer ? Math.max(16, Math.min(100, options.playerCondition ?? Math.max(72, session.playerCondition - 14))) : Math.max(66, 95 - index * 5),
      isPlayer,
    };
  });

  const playerResult = results.find((result) => result.isPlayer) ?? results[0];

  return {
    mode: "career",
    variantId: session.variant.id,
    title: session.title,
    subtitle: session.subtitle,
    series: session.variant.series,
    location: session.variant.location,
    weatherLabel: session.variant.weatherLabel,
    eventTypeLabel: session.variant.eventTypeLabel,
    setupLabel: session.teamSetup.label,
    sponsorName: session.activeSponsor.name,
    pressureCallLabel: session.pressureCall?.label ?? null,
    pressureTargetId: session.pressureTargetId,
    pressureTargetName: session.pressureTargetName,
    results,
    playerResult,
    didSetTimeTrialRecord: false,
  };
}

function buildPressureAftermath(
  profileBefore: PlayerProfile,
  profileAfter: PlayerProfile,
  completion: RaceCompletion,
  pressureOutcome: PressureCallOutcome | null,
  nextHeat: TrackVariant | null,
): PressureAftermath | null {
  if (!pressureOutcome) {
    return null;
  }

  const playerBefore = profileBefore.standings.find((entry) => entry.isPlayer) ?? null;
  const playerAfter = profileAfter.standings.find((entry) => entry.isPlayer) ?? null;
  const targetBefore = completion.pressureTargetId
    ? profileBefore.standings.find((entry) => entry.driverId === completion.pressureTargetId) ?? null
    : null;
  const targetAfter = completion.pressureTargetId
    ? profileAfter.standings.find((entry) => entry.driverId === completion.pressureTargetId) ?? null
    : null;
  const targetResult = completion.pressureTargetId
    ? completion.results.find((entry) => entry.driverId === completion.pressureTargetId) ?? null
    : null;
  const pointsGapBefore = playerBefore && targetBefore ? playerBefore.points - targetBefore.points : null;
  const pointsGapAfter = playerAfter && targetAfter ? playerAfter.points - targetAfter.points : null;
  const pointsGapSwing =
    pointsGapBefore !== null && pointsGapAfter !== null ? pointsGapAfter - pointsGapBefore : null;
  const reportHeadline = pressureOutcome.success
    ? pressureOutcome.bonusCredits > 0
      ? "The pressure call paid on track and on the books."
      : "The pressure call turned late-season risk into real position."
    : pressureOutcome.bonusCredits > 0
      ? "The gamble missed, so the garage carries the risk without the payout."
      : "The pressure move raised the temperature, but the title fight is still unresolved.";
  const reportSummary =
    pointsGapSwing !== null
      ? pointsGapSwing > 0
        ? `${pressureOutcome.summary} The standings swing moved ${Math.abs(pointsGapSwing)} points your way.`
        : pointsGapSwing < 0
          ? `${pressureOutcome.summary} The standings swing moved ${Math.abs(pointsGapSwing)} points away from you.`
          : `${pressureOutcome.summary} The title gap held steady, so the next grid still matters just as much.`
      : pressureOutcome.summary;
  const recommendation =
    completion.playerResult.condition <= 58
      ? `The shell is down to ${completion.playerResult.condition}%. Patch the car before ${nextHeat?.name ?? "the next heat"} or the pressure call will leave a repair scar.`
      : pressureOutcome.bonusCredits > 0
        ? `Bank the bonus and decide whether ${nextHeat?.name ?? "the next heat"} gets a fresh upgrade push or a calmer service stop.`
        : pressureOutcome.success
          ? `Carry the momentum into ${nextHeat?.name ?? "the next heat"}, but avoid turning a landed call into a reckless follow-up.`
          : `Reset the garage tone before ${nextHeat?.name ?? "the next heat"}. The rivalry is still alive, so the next clean result matters more than another stunt.`;

  return {
    label: pressureOutcome.label,
    reportHeadline,
    reportSummary,
    targetName: pressureOutcome.targetName,
    playerFinishPosition: completion.playerResult.finishPosition,
    targetFinishPosition: targetResult?.finishPosition ?? null,
    pointsGapBefore,
    pointsGapAfter,
    pointsGapSwing,
    creditsAfter: profileAfter.credits,
    conditionAfter: profileAfter.condition,
    nextEventLabel: nextHeat ? `${nextHeat.series} // ${nextHeat.name}` : "Season complete",
    recommendation,
  };
}

export class ChampionshipManager {
  private profile: PlayerProfile;
  private readonly storageMode: "persistent" | "memory";

  constructor(options: ChampionshipManagerOptions = {}) {
    this.storageMode = options.storageMode ?? "persistent";
    this.profile =
      options.freshProfile || this.storageMode === "memory"
        ? createInitialProfile()
        : loadProfile();
    sortStandings(this.profile);
  }

  private save() {
    if (this.storageMode !== "persistent") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
  }

  private getActiveSponsorDefinition(roundIndex = this.profile.currentHeatIndex) {
    return getSponsorContractById(getSafeActiveSponsorId(this.profile.activeSponsorId, roundIndex));
  }

  private getActivePressureCallDefinition(roundIndex = this.profile.currentHeatIndex) {
    if (this.profile.activePressureCallRound !== roundIndex) {
      return null;
    }

    return getPressureCallByKey(this.profile.activePressureCallKey);
  }

  private getPressureDeskOpen(roundIndex = this.profile.currentHeatIndex) {
    return this.profile.status === "active" && roundIndex >= PRESSURE_CALLS[0].unlockRound && roundIndex < TRACK_VARIANTS.length;
  }

  private getSelectedSetupDefinition() {
    return getTeamSetupByKey(this.profile.selectedSetup);
  }

  private getEventThreatStanding(variant: TrackVariant | null = this.getCurrentHeat()) {
    const eligibleIds = variant?.fieldIds?.length ? new Set(variant.fieldIds) : null;
    const eligibleRivals = this.profile.standings.filter(
      (entry) => !entry.isPlayer && (!eligibleIds || eligibleIds.has(entry.driverId)),
    );

    return eligibleRivals[0] ?? this.profile.standings.find((entry) => !entry.isPlayer) ?? null;
  }

  private getRepairDiscount() {
    return this.getActiveSponsorDefinition().repairDiscount ?? 0;
  }

  private getUpgradeDiscount() {
    return this.getActiveSponsorDefinition().upgradeDiscount ?? 0;
  }

  private applyDiscount(cost: number, discount: number) {
    return Math.ceil(cost * (1 - discount));
  }

  getProfile() {
    return cloneProfile(this.profile);
  }

  getHeatByIndex(index: number) {
    return TRACK_VARIANTS[index] ?? null;
  }

  getCurrentHeat() {
    return this.getHeatByIndex(this.profile.currentHeatIndex);
  }

  getActiveSponsor() {
    return this.getActiveSponsorDefinition();
  }

  getActivePressureCall() {
    return this.getActivePressureCallDefinition();
  }

  getAvailableSponsors() {
    return getAvailableSponsorsForIndex(this.profile.currentHeatIndex);
  }

  getAvailablePressureCalls() {
    return this.getPressureDeskOpen() ? getAvailablePressureCallsForIndex(this.profile.currentHeatIndex) : [];
  }

  getSelectedSetup() {
    return this.getSelectedSetupDefinition();
  }

  getSetupPlans() {
    return TEAM_SETUPS;
  }

  getPressureTarget(variantId?: string) {
    const variant = variantId ? getVariantById(variantId) : this.getCurrentHeat();
    return this.getEventThreatStanding(variant);
  }

  setActiveSponsor(contractId: string) {
    const available = this.getAvailableSponsors();
    const contract = available.find((entry) => entry.id === contractId);
    if (!contract) {
      return { ok: false, message: "That sponsor desk is not open for this stage of the season yet." };
    }

    this.profile.activeSponsorId = contract.id;
    this.save();
    return { ok: true, message: `${contract.name} signed for the next event.` };
  }

  setTeamSetup(key: TeamSetupKey) {
    const setup = TEAM_SETUPS.find((entry) => entry.key === key);
    if (!setup) {
      return { ok: false, message: "Unknown setup plan." };
    }

    this.profile.selectedSetup = setup.key;
    this.save();
    return { ok: true, message: `${setup.label} loaded for the next event.` };
  }

  setPressureCall(key: PressureCallKey) {
    if (!this.getPressureDeskOpen()) {
      return { ok: false, message: "The late-season pressure desk is not open yet." };
    }

    if (this.profile.activePressureCallRound === this.profile.currentHeatIndex && this.profile.activePressureCallKey) {
      return { ok: false, message: "A championship call is already locked for this event." };
    }

    const call = this.getAvailablePressureCalls().find((entry) => entry.key === key);
    if (!call) {
      return { ok: false, message: "Unknown championship call." };
    }

    if (this.profile.credits < call.cost) {
      return { ok: false, message: `Not enough credits to fund ${call.label.toLowerCase()}.` };
    }

    this.profile.credits -= call.cost;
    this.profile.activePressureCallKey = call.key;
    this.profile.activePressureCallRound = this.profile.currentHeatIndex;
    this.save();
    return { ok: true, message: `${call.label} locked for ${this.getCurrentHeat()?.name ?? "the next event"}.` };
  }

  getRepairQuotes() {
    const missingCondition = Math.max(0, 100 - this.profile.condition);
    const patchRestore = Math.min(missingCondition, 18);
    const fullRestore = missingCondition;
    const rawPatchCost = patchRestore === 0 ? 0 : 140 + patchRestore * 5;
    const rawFullCost = fullRestore === 0 ? 0 : 220 + fullRestore * 6;
    const repairDiscount = this.getRepairDiscount();

    return {
      patchRestore,
      patchCost: this.applyDiscount(rawPatchCost, repairDiscount),
      fullRestore,
      fullCost: this.applyDiscount(rawFullCost, repairDiscount),
      repairDiscount,
    };
  }

  private buildSessionConfig(mode: RaceSessionConfig["mode"], variant: TrackVariant, includeRivals: boolean): RaceSessionConfig {
    const pressureCall = this.getActivePressureCallDefinition();
    const pressureTarget = pressureCall ? this.getEventThreatStanding(variant) : null;
    const drivers = createDriverGrid(variant, includeRivals).map((driver) => {
      if (!pressureCall || !pressureTarget || driver.id !== pressureTarget.driverId) {
        return driver;
      }

      return {
        ...driver,
        skill: Math.max(0.42, driver.skill + (pressureCall.rivalSkillDelta ?? 0)),
        aggression: Math.min(0.96, Math.max(0.2, driver.aggression + (pressureCall.rivalAggressionDelta ?? 0))),
      };
    });
    const playerUpgrades = { ...this.profile.upgrades };

    if (pressureCall?.tempUpgradeBoosts) {
      Object.entries(pressureCall.tempUpgradeBoosts).forEach(([key, value]) => {
        playerUpgrades[key as UpgradeKey] += value ?? 0;
      });
    }

    return {
      mode,
      variant,
      title: variant.name,
      subtitle: variant.subtitle,
      briefing: variant.briefing,
      objective: variant.objective,
      tutorialHints: variant.tutorialFocus,
      drivers,
      playerCondition: this.profile.condition,
      playerUpgrades,
      playerCredits: this.profile.credits,
      teamSetup: this.getSelectedSetupDefinition(),
      activeSponsor: this.getActiveSponsorDefinition(),
      pressureCall,
      pressureTargetId: pressureTarget?.driverId ?? null,
      pressureTargetName: pressureTarget?.name ?? null,
      countdownEnabled: mode !== "attract",
    };
  }

  beginCareer() {
    if (this.profile.status !== "active") {
      this.profile.status = "active";
      this.profile.currentHeatIndex = 0;
      this.profile.history = [];
      this.profile.standings = createInitialStandings();
      this.profile.selectedSetup = TEAM_SETUPS[0].key;
      this.profile.activeSponsorId = SPONSOR_CONTRACTS[0].id;
      sortStandings(this.profile);
      this.save();
    }

    return this.getCareerSession();
  }

  restartCareerFromScratch() {
    const fresh = createInitialProfile();
    fresh.options = { ...this.profile.options };
    this.profile = fresh;
    this.profile.status = "active";
    this.save();
    return this.getCareerSession();
  }

  createReviewPostRaceResolution() {
    const openerSession = this.restartCareerFromScratch();
    return this.applyCareerResult(createDeterministicReviewCompletion(openerSession));
  }

  createReviewLateSeasonSession() {
    this.restartCareerFromScratch();

    const scriptedRounds: Array<{
      setup: TeamSetupKey;
      sponsor: string;
      finish: number;
      condition: number;
      postActions: Array<() => void>;
    }> = [
      {
        setup: "balanced",
        sponsor: "vector-works",
        finish: 4,
        condition: 88,
        postActions: [() => void this.purchaseUpgrade("engine")],
      },
      {
        setup: "attack",
        sponsor: "vector-works",
        finish: 3,
        condition: 81,
        postActions: [() => void this.purchaseUpgrade("tyres")],
      },
      {
        setup: "endurance",
        sponsor: "harbor-union",
        finish: 5,
        condition: 74,
        postActions: [() => void this.repair("patch"), () => void this.purchaseUpgrade("brakes")],
      },
      {
        setup: "attack",
        sponsor: "tidefire-energy",
        finish: 2,
        condition: 72,
        postActions: [() => void this.purchaseUpgrade("nitro")],
      },
      {
        setup: "stability",
        sponsor: "deep-current",
        finish: 4,
        condition: 69,
        postActions: [() => void this.repair("patch")],
      },
    ];

    scriptedRounds.forEach((round) => {
      void this.setTeamSetup(round.setup);
      void this.setActiveSponsor(round.sponsor);
      const session = this.getCareerSession();
      this.applyCareerResult(
        createDeterministicReviewCompletion(session, {
          playerFinishPosition: round.finish,
          playerCondition: round.condition,
        }),
      );
      round.postActions.forEach((action) => action());
    });

    void this.setActiveSponsor("skyline-broadcast");
    void this.setTeamSetup("attack");
    this.profile.activePressureCallKey = null;
    this.profile.activePressureCallRound = null;
    this.save();
    return this.getCareerSession();
  }

  createReviewLateSeasonResolution() {
    this.createReviewLateSeasonSession();
    void this.setPressureCall("bonus-clause");
    const session = this.getCareerSession();
    const targetId = session.pressureTargetId;

    return this.applyCareerResult(
      createDeterministicReviewCompletion(session, {
        playerFinishPosition: 2,
        playerCondition: 61,
        fixedPlacements: targetId ? { [targetId]: 4 } : undefined,
      }),
    );
  }

  getCareerSession() {
    const heat = this.getCurrentHeat() ?? TRACK_VARIANTS[0];
    return this.buildSessionConfig("career", heat, true);
  }

  createSingleRaceSession(variantId: string) {
    return this.buildSessionConfig("single", getVariantById(variantId), true);
  }

  createTimeTrialSession(variantId: string) {
    return this.buildSessionConfig("timeTrial", getVariantById(variantId), false);
  }

  createAttractSession() {
    const variant = getVariantById(TRACK_VARIANTS[0].id);
    return this.buildSessionConfig("attract", variant, true);
  }

  applyCareerResult(completion: RaceCompletion): CareerResolution {
    const currentHeatIndex = this.profile.currentHeatIndex;
    const profileBefore = this.getProfile();
    const playerResult = completion.playerResult;
    const contractOutcome = evaluateSponsorContract(this.getActiveSponsorDefinition(currentHeatIndex), completion);
    const pressureCall = this.getActivePressureCallDefinition(currentHeatIndex);
    const pressureOutcome = pressureCall ? evaluatePressureCall(pressureCall, completion) : null;

    this.profile.credits += playerResult.purseAwarded + contractOutcome.bonusCredits + (pressureOutcome?.bonusCredits ?? 0);
    this.profile.condition = Math.max(16, Math.min(100, playerResult.condition));
    this.profile.history.push({
      variantId: completion.variantId,
      title: completion.title,
      subtitle: completion.subtitle,
      series: completion.series,
      location: completion.location,
      weatherLabel: completion.weatherLabel,
      eventTypeLabel: completion.eventTypeLabel,
      setupLabel: completion.setupLabel,
      sponsorName: completion.sponsorName,
      sponsorBonus: contractOutcome.bonusCredits,
      sponsorTargetHit: contractOutcome.success,
      purseEarned: playerResult.purseAwarded,
      finishPosition: playerResult.finishPosition,
      conditionAfter: playerResult.condition,
      bestLapMs: playerResult.bestLapMs,
      pressureCallLabel: completion.pressureCallLabel,
      pressureTargetName: completion.pressureTargetName,
      pressureBonusCredits: pressureOutcome?.bonusCredits ?? 0,
      pressureSucceeded: pressureOutcome?.success ?? false,
      results: completion.results,
    });

    completion.results.forEach((result) => {
      const standing = this.profile.standings.find((entry) => entry.driverId === result.driverId);
      if (!standing) return;
      standing.points += result.pointsAwarded;
      standing.purse += result.purseAwarded;
      standing.bestFinish = Math.min(standing.bestFinish, result.finishPosition);
      standing.lastFinish = result.finishPosition;
      if (result.bestLapMs && (!standing.bestLapMs || result.bestLapMs < standing.bestLapMs)) {
        standing.bestLapMs = result.bestLapMs;
      }
    });

    sortStandings(this.profile);
    this.profile.tutorialSeen = true;
    this.profile.activePressureCallKey = null;
    this.profile.activePressureCallRound = null;
    this.profile.currentHeatIndex += 1;
    this.profile.activeSponsorId = getSafeActiveSponsorId(this.profile.activeSponsorId, this.profile.currentHeatIndex);

    const nextHeat = this.getCurrentHeat();
    const careerFinished = !nextHeat;
    this.profile.status = careerFinished ? "completed" : "active";
    this.save();
    const resolvedProfile = this.getProfile();
    const totalPrize = playerResult.purseAwarded + contractOutcome.bonusCredits + (pressureOutcome?.bonusCredits ?? 0);
    const pressureAftermath = buildPressureAftermath(profileBefore, resolvedProfile, completion, pressureOutcome, nextHeat);

    return {
      profile: resolvedProfile,
      completion,
      nextHeat,
      cupFinished: careerFinished,
      totalPrize,
      contractOutcome,
      pressureOutcome,
      pressureAftermath,
      storyBeat: buildStoryBeat(completion, currentHeatIndex, careerFinished, contractOutcome, pressureOutcome),
    };
  }

  recordTimeTrial(variantId: string, lapMs: number) {
    const currentRecord = this.profile.bestTimeTrialMs[variantId];
    if (!currentRecord || lapMs < currentRecord) {
      this.profile.bestTimeTrialMs[variantId] = lapMs;
      this.save();
      return true;
    }

    return false;
  }

  saveOptions(options: AudioOptions) {
    this.profile.options = { ...options };
    this.save();
  }

  purchaseUpgrade(key: UpgradeKey) {
    const definition = UPGRADE_DEFINITIONS.find((entry) => entry.key === key);
    if (!definition) {
      return { ok: false, message: "Unknown garage upgrade." };
    }

    const nextCost = this.getNextUpgradeCost(key);
    if (nextCost === null) {
      return { ok: false, message: `${definition.shortLabel} is already at the cap for this career build.` };
    }

    if (this.profile.credits < nextCost) {
      return { ok: false, message: `Not enough credits for ${definition.shortLabel.toLowerCase()}.` };
    }

    this.profile.credits -= nextCost;
    this.profile.upgrades[key] += 1;
    this.save();
    return { ok: true, message: `${definition.shortLabel} upgraded.` };
  }

  repair(kind: "patch" | "full") {
    const quotes = this.getRepairQuotes();
    const restore = kind === "patch" ? quotes.patchRestore : quotes.fullRestore;
    const cost = kind === "patch" ? quotes.patchCost : quotes.fullCost;

    if (restore <= 0) {
      return { ok: false, message: "The shell is already clean enough to roll." };
    }

    if (this.profile.credits < cost) {
      return { ok: false, message: "Not enough credits for the repair quote." };
    }

    this.profile.credits -= cost;
    this.profile.condition = Math.min(100, this.profile.condition + restore);
    this.save();

    return {
      ok: true,
      message: kind === "patch" ? "Quick service fitted." : "Full garage service complete.",
    };
  }

  getCupProgressLabel() {
    if (this.profile.status === "completed") {
      return "Career season complete";
    }

    if (this.profile.status === "active") {
      const current = this.getCurrentHeat();
      return current
        ? `${current.series} // Round ${this.profile.currentHeatIndex + 1} of ${TRACK_VARIANTS.length}`
        : "Career season active";
    }

    return "Career season not started";
  }

  getNextUpgradeCost(key: UpgradeKey) {
    const definition = UPGRADE_DEFINITIONS.find((entry) => entry.key === key);
    if (!definition) return null;
    const rawCost = definition.costs[this.profile.upgrades[key]];
    if (typeof rawCost !== "number") return null;
    return this.applyDiscount(rawCost, this.getUpgradeDiscount());
  }

  getHeatRecord(variantId: string) {
    return this.profile.bestTimeTrialMs[variantId] ?? null;
  }

  getStandingsTable() {
    return this.getProfile().standings;
  }
}
