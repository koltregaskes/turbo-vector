import { POINTS_TABLE } from "../content";
import type {
  ControlState,
  DriverGridEntry,
  HudStandingChip,
  RaceCompletion,
  RaceEvent,
  RaceHudSnapshot,
  RaceRenderSnapshot,
  RaceResultEntry,
  RaceSessionConfig,
  TrackHazard,
  Vector2,
} from "../types";

type TrackSegment = {
  a: Vector2;
  b: Vector2;
  length: number;
  cumulativeStart: number;
  tangent: Vector2;
  normal: Vector2;
};

type BuiltTrack = {
  segments: TrackSegment[];
  totalLength: number;
};

type Projection = {
  point: Vector2;
  distance: number;
  signedDistance: number;
  progress: number;
  tangent: Vector2;
  normal: Vector2;
};

type RuntimeStats = {
  maxSpeed: number;
  acceleration: number;
  brakeForce: number;
  turnRate: number;
  grip: number;
  damageTakenFactor: number;
  wearFactor: number;
  boostCapacity: number;
  boostRecharge: number;
  boostForce: number;
};

type CarState = {
  grid: DriverGridEntry;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  lap: number;
  progress: number;
  lastProgress: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  lapStartedAtMs: number;
  finishTimeMs: number | null;
  rank: number;
  condition: number;
  boost: number;
  boosting: boolean;
  offTrack: boolean;
  contactCooldown: number;
  baseStats: RuntimeStats;
  aiSeed: number;
};

type DriveInput = {
  throttle: number;
  brake: number;
  steer: number;
  boost: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function dot(a: Vector2, b: Vector2) {
  return a.x * b.x + a.y * b.y;
}

function magnitude(vector: Vector2) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector: Vector2): Vector2 {
  const length = magnitude(vector) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function subtract(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function distance(a: Vector2, b: Vector2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function wrapAngle(angle: number) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function wrapProgress(progress: number, totalLength: number) {
  const wrapped = progress % totalLength;
  return wrapped < 0 ? wrapped + totalLength : wrapped;
}

function formatGapLabel(value: number, leader: boolean) {
  if (leader) return "Leader";
  return `+${Math.abs(value).toFixed(1)}s`;
}

function buildTrack(centerline: Vector2[]): BuiltTrack {
  const segments: TrackSegment[] = [];
  let cumulative = 0;

  for (let index = 0; index < centerline.length; index += 1) {
    const a = centerline[index];
    const b = centerline[(index + 1) % centerline.length];
    const vector = subtract(b, a);
    const length = magnitude(vector);
    const tangent = normalize(vector);
    const normal = { x: -tangent.y, y: tangent.x };
    segments.push({
      a,
      b,
      length,
      cumulativeStart: cumulative,
      tangent,
      normal,
    });
    cumulative += length;
  }

  return {
    segments,
    totalLength: cumulative,
  };
}

function projectPoint(track: BuiltTrack, point: Vector2): Projection {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProjection: Projection | null = null;

  track.segments.forEach((segment) => {
    const segmentVector = subtract(segment.b, segment.a);
    const segmentLengthSq = segment.length * segment.length || 1;
    const relative = subtract(point, segment.a);
    const t = clamp(dot(relative, segmentVector) / segmentLengthSq, 0, 1);
    const projected = {
      x: segment.a.x + segmentVector.x * t,
      y: segment.a.y + segmentVector.y * t,
    };
    const delta = subtract(point, projected);
    const distanceToLine = magnitude(delta);

    if (distanceToLine < bestDistance) {
      const signedDistance = dot(delta, segment.normal);
      bestDistance = distanceToLine;
      bestProjection = {
        point: projected,
        distance: distanceToLine,
        signedDistance,
        progress: segment.cumulativeStart + segment.length * t,
        tangent: segment.tangent,
        normal: segment.normal,
      };
    }
  });

  if (!bestProjection) {
    throw new Error("Track projection failed");
  }

  return bestProjection;
}

function sampleTrack(track: BuiltTrack, progress: number) {
  const wrappedProgress = wrapProgress(progress, track.totalLength);

  for (const segment of track.segments) {
    const segmentEnd = segment.cumulativeStart + segment.length;
    if (wrappedProgress <= segmentEnd) {
      const local = (wrappedProgress - segment.cumulativeStart) / segment.length;
      return {
        point: {
          x: lerp(segment.a.x, segment.b.x, local),
          y: lerp(segment.a.y, segment.b.y, local),
        },
        tangent: segment.tangent,
        normal: segment.normal,
      };
    }
  }

  const fallback = track.segments[track.segments.length - 1];
  return {
    point: fallback.b,
    tangent: fallback.tangent,
    normal: fallback.normal,
  };
}

function createPlayerStats(
  upgrades: RaceSessionConfig["playerUpgrades"],
  teamSetup: RaceSessionConfig["teamSetup"],
): RuntimeStats {
  const baseBoostCapacity = upgrades.nitro > 0 ? 34 + upgrades.nitro * 18 : 0;
  const baseBoostRecharge = upgrades.nitro > 0 ? 7 + upgrades.nitro * 3 : 0;
  const baseBoostForce = upgrades.nitro > 0 ? 74 + upgrades.nitro * 10 : 0;

  return {
    maxSpeed: 238 + upgrades.engine * 18 + teamSetup.maxSpeedDelta,
    acceleration: 150 + upgrades.engine * 16 + teamSetup.accelerationDelta,
    brakeForce: 215 + upgrades.brakes * 28 + teamSetup.brakeForceDelta,
    turnRate: 1.92 + upgrades.brakes * 0.11 + upgrades.tyres * 0.08 + teamSetup.turnRateDelta,
    grip: 4.3 + upgrades.tyres * 0.66 + teamSetup.gripDelta,
    damageTakenFactor: (1 - upgrades.armor * 0.1) * teamSetup.damageTakenMultiplier,
    wearFactor: teamSetup.wearFactor,
    boostCapacity: Math.max(0, baseBoostCapacity + teamSetup.boostCapacityDelta),
    boostRecharge: Math.max(0, baseBoostRecharge + teamSetup.boostRechargeDelta),
    boostForce: Math.max(0, baseBoostForce + teamSetup.boostForceDelta),
  };
}

function createAiStats(driver: DriverGridEntry): RuntimeStats {
  return {
    maxSpeed: 225 + driver.skill * 26,
    acceleration: 144 + driver.skill * 24,
    brakeForce: 205 + (1 - driver.aggression) * 26,
    turnRate: 1.82 + driver.skill * 0.28,
    grip: 4.1 + driver.skill * 0.52,
    damageTakenFactor: 0.96 + driver.aggression * 0.08,
    wearFactor: 1,
    boostCapacity: 26 + driver.skill * 18,
    boostRecharge: 8.5 + driver.skill * 4,
    boostForce: 64 + driver.skill * 12,
  };
}

function effectiveStats(base: RuntimeStats, condition: number): RuntimeStats {
  const conditionFactor = 0.72 + (condition / 100) * 0.28;
  return {
    ...base,
    maxSpeed: base.maxSpeed * conditionFactor,
    acceleration: base.acceleration * lerp(0.7, 1, condition / 100),
    brakeForce: base.brakeForce * lerp(0.82, 1, condition / 100),
    turnRate: base.turnRate * lerp(0.78, 1, condition / 100),
    grip: base.grip * lerp(0.76, 1, condition / 100),
  };
}

export class RaceSimulation {
  private readonly track: BuiltTrack;
  private readonly cars: CarState[];
  private readonly config: RaceSessionConfig;
  private readonly events: RaceEvent[] = [];
  private readonly playerCar: CarState;
  private elapsedMs = 0;
  private countdownMs: number;
  private completion: RaceCompletion | null = null;
  private finishBufferMs = 0;

  constructor(config: RaceSessionConfig) {
    this.config = config;
    this.track = buildTrack(config.variant.centerline);
    this.countdownMs = config.countdownEnabled ? 3200 : 0;
    const playerBaseStats = createPlayerStats(config.playerUpgrades, config.teamSetup);
    this.cars = config.drivers.map((driver, index) => {
      const gridOffset = index * 56;
      const sample = sampleTrack(this.track, this.track.totalLength - gridOffset);
      const baseStats = driver.isPlayer ? playerBaseStats : createAiStats(driver);
      const boostCapacity = baseStats.boostCapacity;
      return {
        grid: driver,
        x: sample.point.x - sample.normal.x * (driver.isPlayer ? 0 : driver.laneBias * 50),
        y: sample.point.y - sample.normal.y * (driver.isPlayer ? 0 : driver.laneBias * 50),
        vx: 0,
        vy: 0,
        heading: Math.atan2(sample.tangent.y, sample.tangent.x),
        lap: 0,
        progress: this.track.totalLength - gridOffset,
        lastProgress: this.track.totalLength - gridOffset,
        bestLapMs: null,
        lastLapMs: null,
        lapStartedAtMs: 0,
        finishTimeMs: null,
        rank: index + 1,
        condition: driver.isPlayer ? config.playerCondition : 96,
        boost: boostCapacity,
        boosting: false,
        offTrack: false,
        contactCooldown: 0,
        baseStats,
        aiSeed: index * 1.37 + driver.skill * 10,
      };
    });
    this.playerCar = this.cars.find((car) => car.grid.isPlayer) ?? this.cars[0];
    this.updateRanks();
  }

  private queueEvent(event: RaceEvent) {
    this.events.push(event);
  }

  private damageCar(car: CarState, amount: number) {
    const applied = amount * car.baseStats.damageTakenFactor;
    car.condition = clamp(car.condition - applied, 0, 100);
    car.contactCooldown = 0.28;

    if (car.grid.isPlayer) {
      this.queueEvent({ type: "impact", intensity: clamp(applied / 18, 0.2, 1.4) });
    }
  }

  private createPlayerInput(controls: ControlState): DriveInput {
    if (this.config.mode === "attract") {
      return this.createAiInput(this.playerCar);
    }

    return {
      throttle: controls.throttle ? 1 : 0,
      brake: controls.brake ? 1 : 0,
      steer: (controls.left ? -1 : 0) + (controls.right ? 1 : 0),
      boost: controls.boost,
    };
  }

  private createAiInput(car: CarState): DriveInput {
    const projection = projectPoint(this.track, { x: car.x, y: car.y });
    const speed = Math.hypot(car.vx, car.vy);
    const lookAhead = 155 + speed * 0.55 + car.grid.skill * 70;
    const targetSample = sampleTrack(this.track, projection.progress + lookAhead);
    const futureSample = sampleTrack(this.track, projection.progress + lookAhead + 150);
    const lineOffset = targetSample.normal;
    const laneOffset = car.grid.laneBias * this.config.variant.width * 0.22;
    let targetPoint = {
      x: targetSample.point.x + lineOffset.x * laneOffset,
      y: targetSample.point.y + lineOffset.y * laneOffset,
    };

    const rivalAhead = this.cars.find((other) => {
      if (other.grid.id === car.grid.id) return false;
      const progressDelta =
        (other.lap - car.lap) * this.track.totalLength + (other.progress - car.progress);
      return progressDelta > 0 && progressDelta < 120 && distance({ x: other.x, y: other.y }, { x: car.x, y: car.y }) < 120;
    });

    if (rivalAhead) {
      const dodge = car.grid.aggression > 0.7 ? 1 : -1;
      targetPoint = {
        x: targetPoint.x + targetSample.normal.x * dodge * 42,
        y: targetPoint.y + targetSample.normal.y * dodge * 42,
      };
    }

    const targetAngle = Math.atan2(targetPoint.y - car.y, targetPoint.x - car.x);
    const angleDelta = wrapAngle(targetAngle - car.heading);
    const cornerSeverity = clamp((1 - dot(targetSample.tangent, futureSample.tangent)) * 0.5, 0, 1);
    let targetSpeed =
      effectiveStats(car.baseStats, car.condition).maxSpeed *
      (0.78 + car.grid.skill * 0.22) *
      (1 - cornerSeverity * (0.52 - car.grid.skill * 0.18));

    for (const hazard of this.config.variant.hazards) {
      const hazardProgress = projectPoint(this.track, hazard.position).progress;
      const deltaProgress = wrapProgress(hazardProgress - projection.progress, this.track.totalLength);
      if (deltaProgress > 0 && deltaProgress < 140 && hazard.type !== "boost") {
        targetSpeed *= hazard.type === "barrier" ? 0.8 : 0.87;
      }
    }

    if (projection.distance > this.config.variant.width * 0.28) {
      targetSpeed *= 0.78;
    }

    const throttle = speed < targetSpeed - 12 ? 1 : speed < targetSpeed + 8 ? 0.45 : 0;
    const brake = speed > targetSpeed + 22 ? 1 : 0;
    const boost =
      car.boost > 24 && cornerSeverity < 0.08 && speed > 118 && Math.sin((this.elapsedMs / 1000) + car.aiSeed) > 0.98;

    return {
      throttle,
      brake,
      steer: clamp(angleDelta * 2.3, -1, 1),
      boost,
    };
  }

  private applyHazards(car: CarState, projection: Projection, stats: RuntimeStats) {
    let gripFactor = this.config.variant.gripModifier;
    let speedCap = stats.maxSpeed;
    const trackHalfWidth = this.config.variant.width * 0.5;
    const offTrackDepth = Math.max(0, projection.distance - trackHalfWidth);

    if (offTrackDepth > 0) {
      gripFactor *= clamp(1 - offTrackDepth / 160, 0.22, 0.72);
      speedCap = lerp(stats.maxSpeed, 88, clamp(offTrackDepth / 160, 0, 1));
      car.offTrack = true;
    } else {
      car.offTrack = false;
    }

    for (const hazard of this.config.variant.hazards) {
      const gap = distance({ x: car.x, y: car.y }, hazard.position);
      if (gap > hazard.radius) continue;

      if (hazard.type === "oil") {
        gripFactor *= lerp(0.28, 0.58, 1 - clamp((hazard.radius - gap) / hazard.radius, 0, 1));
      } else if (hazard.type === "barrier") {
        const impact = Math.max(0, Math.hypot(car.vx, car.vy) - 90) * 0.06;
        if (impact > 0 && car.contactCooldown <= 0) {
          this.damageCar(car, impact + hazard.intensity * 2.6);
        }
        car.vx *= 0.44;
        car.vy *= 0.44;
        speedCap = Math.min(speedCap, 92);
      } else if (hazard.type === "boost") {
        car.boost = Math.min(stats.boostCapacity, car.boost + hazard.intensity * 20 * (1 / 60));
      }
    }

    return {
      gripFactor,
      speedCap,
      offTrackDepth,
    };
  }

  private applyConditionWear(car: CarState, forwardSpeed: number, dt: number) {
    const paceFactor = clamp(forwardSpeed / Math.max(car.baseStats.maxSpeed, 1), 0.2, 1.08);
    const setupWearFactor = car.baseStats.wearFactor;
    const passiveWear = dt * this.config.variant.wearRate * setupWearFactor * (0.003 + paceFactor * 0.012);
    const offTrackWear = car.offTrack ? dt * this.config.variant.wearRate * setupWearFactor * 0.05 : 0;
    const boostWear = car.boosting ? dt * this.config.variant.wearRate * setupWearFactor * 0.008 : 0;
    car.condition = clamp(car.condition - passiveWear - offTrackWear - boostWear, 0, 100);
  }

  private updateRanks() {
    const ranking = [...this.cars].sort((left, right) => {
      if (left.finishTimeMs !== null && right.finishTimeMs !== null) {
        return left.finishTimeMs - right.finishTimeMs;
      }

      if (left.finishTimeMs !== null) return -1;
      if (right.finishTimeMs !== null) return 1;

      if (right.lap !== left.lap) return right.lap - left.lap;
      return right.progress - left.progress;
    });

    ranking.forEach((car, index) => {
      car.rank = index + 1;
    });
  }

  private maybeCompleteLap(car: CarState, forwardSpeed: number) {
    if (car.finishTimeMs !== null) return;

    const crossedStart =
      car.lastProgress > this.track.totalLength * 0.84 &&
      car.progress < this.track.totalLength * 0.18 &&
      forwardSpeed > 42;

    if (!crossedStart) return;

    const lapTimeMs = this.elapsedMs - car.lapStartedAtMs;
    car.lastLapMs = lapTimeMs;
    if (!car.bestLapMs || lapTimeMs < car.bestLapMs) {
      car.bestLapMs = lapTimeMs;
    }
    car.lap += 1;
    car.lapStartedAtMs = this.elapsedMs;

    if (car.grid.isPlayer) {
      this.queueEvent({ type: "lap", lap: car.lap, bestLapMs: car.bestLapMs });
    }

    if (car.lap >= this.config.variant.laps) {
      car.finishTimeMs = this.elapsedMs;
      if (car.grid.isPlayer) {
        this.queueEvent({ type: "finish", position: car.rank });
      }
    }
  }

  private buildLeaderboard(): HudStandingChip[] {
    const sorted = [...this.cars].sort((left, right) => left.rank - right.rank);
    const leader = sorted[0];
    const leaderReference = leader.finishTimeMs ?? leader.lap * this.track.totalLength + leader.progress;

    return sorted.map((car) => {
      const carReference = car.finishTimeMs ?? car.lap * this.track.totalLength + car.progress;
      const gapSeconds =
        car === leader
          ? 0
          : car.finishTimeMs !== null && leader.finishTimeMs !== null
            ? (car.finishTimeMs - leader.finishTimeMs) / 1000
            : (leaderReference - carReference) / 170;

      return {
        rank: car.rank,
        name: car.grid.name,
        color: car.grid.color,
        isPlayer: car.grid.isPlayer,
        gapLabel: formatGapLabel(gapSeconds, car === leader),
        finished: car.finishTimeMs !== null,
      };
    });
  }

  private finalizeIfReady() {
    if (this.completion || this.config.mode === "attract") {
      return;
    }

    const playerFinished = this.playerCar.finishTimeMs !== null;
    if (!playerFinished) return;

    const everyoneFinished = this.cars.every((car) => car.finishTimeMs !== null);
    if (!everyoneFinished) {
      this.finishBufferMs += 16.67;
      if (this.finishBufferMs < (this.config.mode === "timeTrial" ? 1200 : 5200)) {
        return;
      }
    }

    this.updateRanks();

    const results = [...this.cars]
      .sort((left, right) => left.rank - right.rank)
      .map((car) => {
        const purseAwarded = car.grid.isPlayer && this.config.mode === "career"
          ? this.config.variant.purse[car.rank - 1] ?? 0
          : 0;
        const pointsAwarded =
          this.config.mode === "career"
            ? POINTS_TABLE[car.rank - 1] ?? 0
            : 0;

        return {
          driverId: car.grid.id,
          name: car.grid.name,
          color: car.grid.color,
          accent: car.grid.accent,
          carNumber: car.grid.carNumber,
          sponsor: car.grid.sponsor,
          finishPosition: car.rank,
          finishTimeMs: car.finishTimeMs,
          bestLapMs: car.bestLapMs,
          pointsAwarded,
          purseAwarded,
          condition: Math.round(car.condition),
          isPlayer: car.grid.isPlayer,
        } satisfies RaceResultEntry;
      });

    const playerResult = results.find((entry) => entry.isPlayer);
    if (!playerResult) {
      throw new Error("Player result missing");
    }

    this.completion = {
      mode: this.config.mode,
      variantId: this.config.variant.id,
      title: this.config.title,
      subtitle: this.config.subtitle,
      series: this.config.variant.series,
      location: this.config.variant.location,
      weatherLabel: this.config.variant.weatherLabel,
      eventTypeLabel: this.config.variant.eventTypeLabel,
      setupLabel: this.config.teamSetup.label,
      sponsorName: this.config.activeSponsor.name,
      pressureCallLabel: this.config.pressureCall?.label ?? null,
      pressureTargetId: this.config.pressureTargetId,
      pressureTargetName: this.config.pressureTargetName,
      results,
      playerResult,
      didSetTimeTrialRecord: false,
    };
  }

  step(deltaSeconds: number, controls: ControlState) {
    const dt = clamp(deltaSeconds, 0, 0.05);

    if (controls.restartPressed && this.config.mode !== "attract") {
      this.queueEvent({ type: "restart-requested" });
    }

    if (this.completion && this.config.mode !== "attract") {
      return;
    }

    this.elapsedMs += dt * 1000;
    if (this.countdownMs > 0) {
      this.countdownMs = Math.max(0, this.countdownMs - dt * 1000);
    }

    const playerInput = this.createPlayerInput(controls);

    for (const car of this.cars) {
      const input = car.grid.isPlayer ? playerInput : this.createAiInput(car);
      const stats = effectiveStats(car.baseStats, car.condition);
      const projection = projectPoint(this.track, { x: car.x, y: car.y });
      const surface = this.applyHazards(car, projection, stats);
      const countdownLocked = this.countdownMs > 0;

      car.contactCooldown = Math.max(0, car.contactCooldown - dt);

      const forward = { x: Math.cos(car.heading), y: Math.sin(car.heading) };
      const right = { x: -forward.y, y: forward.x };
      let forwardSpeed = dot({ x: car.vx, y: car.vy }, forward);
      let lateralSpeed = dot({ x: car.vx, y: car.vy }, right);
      const throttle = countdownLocked || car.finishTimeMs !== null ? 0 : input.throttle;
      const brake = countdownLocked || car.finishTimeMs !== null ? 0 : input.brake;
      const steer = countdownLocked || car.finishTimeMs !== null ? 0 : input.steer;
      const wantsBoost = !countdownLocked && car.finishTimeMs === null && input.boost && stats.boostCapacity > 0;

      if (throttle > 0) {
        forwardSpeed += stats.acceleration * throttle * dt;
      } else {
        forwardSpeed *= 1 - 1.22 * dt;
      }

      if (brake > 0) {
        forwardSpeed = Math.max(0, forwardSpeed - stats.brakeForce * brake * dt);
      }

      const turnFactor = clamp(Math.abs(forwardSpeed) / 94, 0.25, 1.1) * lerp(0.55, 1, surface.gripFactor);
      car.heading += steer * stats.turnRate * turnFactor * dt;

      if (wantsBoost && car.boost > 6) {
        forwardSpeed += stats.boostForce * dt;
        car.boost = Math.max(0, car.boost - 30 * dt);
        if (!car.boosting && car.grid.isPlayer) {
          this.queueEvent({ type: "boost" });
        }
        car.boosting = true;
      } else {
        car.boosting = false;
        car.boost = Math.min(stats.boostCapacity, car.boost + stats.boostRecharge * dt);
      }

      lateralSpeed = lerp(lateralSpeed, 0, clamp(stats.grip * surface.gripFactor * dt, 0, 1));
      forwardSpeed = clamp(forwardSpeed, 0, surface.speedCap + (car.boosting ? 32 : 0));

      car.vx = forward.x * forwardSpeed + right.x * lateralSpeed;
      car.vy = forward.y * forwardSpeed + right.y * lateralSpeed;
      car.x += car.vx * dt;
      car.y += car.vy * dt;

      const afterMoveProjection = projectPoint(this.track, { x: car.x, y: car.y });
      if (surface.offTrackDepth > 74) {
        const side = afterMoveProjection.signedDistance >= 0 ? 1 : -1;
        const edgeDistance = this.config.variant.width * 0.5 + 70;
        car.x = afterMoveProjection.point.x + afterMoveProjection.normal.x * side * edgeDistance;
        car.y = afterMoveProjection.point.y + afterMoveProjection.normal.y * side * edgeDistance;
        if (Math.abs(forwardSpeed) > 112 && car.contactCooldown <= 0) {
          this.damageCar(car, (forwardSpeed - 92) * 0.055);
        }
        car.vx *= 0.42;
        car.vy *= 0.42;
      }

      this.applyConditionWear(car, forwardSpeed, dt);
      car.lastProgress = car.progress;
      car.progress = afterMoveProjection.progress;
      this.maybeCompleteLap(car, forwardSpeed);
    }

    for (let index = 0; index < this.cars.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < this.cars.length; otherIndex += 1) {
        const left = this.cars[index];
        const right = this.cars[otherIndex];
        const delta = { x: right.x - left.x, y: right.y - left.y };
        const gap = magnitude(delta);
        const minGap = 38;
        if (gap >= minGap || gap === 0) continue;

        const normal = normalize(delta);
        const overlap = minGap - gap;
        left.x -= normal.x * overlap * 0.5;
        left.y -= normal.y * overlap * 0.5;
        right.x += normal.x * overlap * 0.5;
        right.y += normal.y * overlap * 0.5;

        const relativeVelocity = Math.abs((right.vx - left.vx) * normal.x + (right.vy - left.vy) * normal.y);
        left.vx *= 0.92;
        left.vy *= 0.92;
        right.vx *= 0.92;
        right.vy *= 0.92;

        if (relativeVelocity > 46) {
          if (left.contactCooldown <= 0) this.damageCar(left, relativeVelocity * 0.032);
          if (right.contactCooldown <= 0) this.damageCar(right, relativeVelocity * 0.032);
        }
      }
    }

    this.updateRanks();
    this.finalizeIfReady();

    if (this.config.mode === "attract" && this.playerCar.finishTimeMs !== null) {
      this.completion = null;
    }
  }

  consumeEvents() {
    return this.events.splice(0, this.events.length);
  }

  getCompletion() {
    return this.completion;
  }

  createHudSnapshot(): RaceHudSnapshot {
    const lapDisplay = this.playerCar.finishTimeMs !== null
      ? this.config.variant.laps
      : Math.min(this.config.variant.laps, this.playerCar.lap + 1);

    const tutorialHint = (() => {
      if (this.config.mode === "attract") return null;
      if (this.config.variant.eventType === "showdown" && this.elapsedMs < 12000) {
        return "Showdown rounds cut the field down to headline names. There is nowhere to hide a lazy lap.";
      }
      if (this.config.variant.eventType === "endurance" && this.elapsedMs < 12000) {
        return "Endurance rounds chew through condition even without huge crashes. Keep the car tidy.";
      }
      if (this.playerCar.condition < 54) return "Condition is falling. Repairs after the heat will cost less than losing the race entirely.";
      if (this.playerCar.rank > 3 && this.playerCar.boost > 22) return "You have enough nitro for a proper pass. Save it for a straight exit, not a panic corner entry.";
      if (this.elapsedMs < 10000) return this.config.tutorialHints[0] ?? null;
      if (this.elapsedMs < 24000) return this.config.tutorialHints[1] ?? null;
      if (this.elapsedMs < 42000) return this.config.tutorialHints[2] ?? null;
      return null;
    })();

    const damageLabel =
      this.playerCar.condition >= 80
        ? "Shell clean"
        : this.playerCar.condition >= 58
          ? "Panels bruised"
          : this.playerCar.condition >= 34
            ? "Handling hurt"
            : "Critical damage";

    return {
      mode: this.config.mode,
      title: this.config.title,
      subtitle: this.config.subtitle,
      objective: this.config.objective,
      lap: lapDisplay,
      totalLaps: this.config.variant.laps,
      position: this.playerCar.rank,
      totalDrivers: this.cars.length,
      speedKph: Math.round(Math.hypot(this.playerCar.vx, this.playerCar.vy) * 1.34),
      condition: Math.round(this.playerCar.condition),
      boost: Math.round(this.playerCar.boost),
      bestLapMs: this.playerCar.bestLapMs,
      lastLapMs: this.playerCar.lastLapMs,
      elapsedMs: this.elapsedMs,
      countdown: Math.ceil(this.countdownMs / 1000),
      tutorialHint,
      standings: this.buildLeaderboard(),
      credits: this.config.playerCredits,
      hazardNotes: `${this.config.variant.weatherLabel} // ${this.config.variant.hazardNotes}`,
      damageLabel,
      boosting: this.playerCar.boosting,
      offTrack: this.playerCar.offTrack,
    };
  }

  createRenderSnapshot(): RaceRenderSnapshot {
    const followTarget =
      this.config.mode === "attract"
        ? [...this.cars].sort((left, right) => left.rank - right.rank)[0]
        : this.playerCar;

    return {
      variant: this.config.variant,
      followTargetId: followTarget.grid.id,
      countdown: Math.ceil(this.countdownMs / 1000),
      cars: this.cars.map((car) => ({
        id: car.grid.id,
        name: car.grid.name,
        color: car.grid.color,
        accent: car.grid.accent,
        isPlayer: car.grid.isPlayer,
        x: car.x,
        y: car.y,
        heading: car.heading,
        rank: car.rank,
        condition: car.condition,
        boosting: car.boosting,
        finished: car.finishTimeMs !== null,
      })),
    };
  }
}
