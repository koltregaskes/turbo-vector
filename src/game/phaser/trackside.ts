import type { MarinaDecoration, TrackVariant } from "../types";

/**
 * Trackside layout: the sizes RaceScene draws each decoration at, and a placement pass that keeps
 * every decoration's footprint off the asphalt. Pure functions, no Phaser.
 */

export const WORLD_WIDTH = 2200;
export const WORLD_HEIGHT = 1400;

/** The land masses RaceScene paints over the water (centre and full size). Everything else is water. */
export const LAND_ELLIPSES = [
  { x: 1240, y: 710, width: 1540, height: 1100 },
  { x: 1170, y: 700, width: 1020, height: 720 },
] as const;

/**
 * RaceScene strokes the asphalt at the variant width along the closed centre line, with curb stripes
 * 17 px wider each side. Decorations must clear the asphalt edge by this margin. They may touch the
 * curb stripes: piers, quay stands and kerbside palms are laid out to meet them.
 */
const ASPHALT_MARGIN = 2;
const NUDGE_LIMIT = 120;
const NUDGE_STEP = 4;
/** Decorations that belong on the water, so a nudge does not need to land them on land. */
const WATER_KINDS: ReadonlySet<MarinaDecoration["kind"]> = new Set(["pier", "yacht"]);

// Kenney Racing Pack native pixel sizes, used to keep aspect ratios.
export const TRIBUNE_SIZE = { width: 448, height: 223 };
export const TYRE_STACK = { size: 38, gap: 4 };

export function tribuneScale(decoration: MarinaDecoration) {
  return Math.min(decoration.width / TRIBUNE_SIZE.width, (decoration.height * 1.6) / TRIBUNE_SIZE.height);
}

export function treeLayout(decoration: MarinaDecoration, index: number) {
  const large = index % 2 === 0;
  return { key: large ? "tree_large" : "tree_small", size: decoration.width * (large ? 1.7 : 1.4) };
}

/** One or two square tents along the footprint's long side. */
export function tentLayout(decoration: MarinaDecoration) {
  const horizontal = decoration.width >= decoration.height;
  const long = Math.max(decoration.width, decoration.height);
  const short = Math.min(decoration.width, decoration.height);
  const count = Math.min(2, Math.max(1, Math.round(long / short)));
  const size = Math.min(short * 1.05, long / count);
  return { horizontal, count, size };
}

export function tyreLayout(decoration: MarinaDecoration) {
  const count = Math.max(2, Math.round(decoration.width / (TYRE_STACK.size + TYRE_STACK.gap)));
  return { count, pitch: TYRE_STACK.size + TYRE_STACK.gap, size: TYRE_STACK.size };
}

export type HasTexture = (key: string) => boolean;

/** True when RaceScene will draw this decoration as Kenney sprites rather than its fallback shape. */
export function usesSprites(decoration: MarinaDecoration, index: number, hasTexture: HasTexture) {
  switch (decoration.kind) {
    case "grandstand":
      return hasTexture("tribune_full");
    case "palm":
      return hasTexture(treeLayout(decoration, index).key);
    case "building":
    case "tower":
      return hasTexture(index % 2 === 0 ? "tent_red_large" : "tent_blue_large");
    case "lights":
      return hasTexture("tires_red") && hasTexture("tires_white");
    default:
      return false;
  }
}

type Rect = { left: number; top: number; right: number; bottom: number };

/** Width and height of what RaceScene actually draws (sprites, or the fallback shape). */
export function decorationSize(decoration: MarinaDecoration, index: number, hasTexture: HasTexture) {
  if (usesSprites(decoration, index, hasTexture)) {
    if (decoration.kind === "grandstand") {
      const scale = tribuneScale(decoration);
      return { width: TRIBUNE_SIZE.width * scale, height: TRIBUNE_SIZE.height * scale };
    }
    if (decoration.kind === "palm") {
      const { size } = treeLayout(decoration, index);
      return { width: size, height: size };
    }
    if (decoration.kind === "building" || decoration.kind === "tower") {
      const { horizontal, count, size } = tentLayout(decoration);
      return horizontal ? { width: count * size, height: size } : { width: size, height: count * size };
    }
    if (decoration.kind === "lights") {
      const { count, pitch, size } = tyreLayout(decoration);
      return { width: count * pitch - TYRE_STACK.gap, height: size };
    }
  }
  if (decoration.kind === "palm") {
    // Canopy circles plus the trunk below them.
    return { width: decoration.width * 1.25, height: decoration.width / 2 + decoration.height / 2 + 8 };
  }
  return { width: decoration.width, height: decoration.height };
}

function rectAt(x: number, y: number, size: { width: number; height: number }): Rect {
  return { left: x - size.width / 2, top: y - size.height / 2, right: x + size.width / 2, bottom: y + size.height / 2 };
}

function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pointRectDistance(px: number, py: number, rect: Rect) {
  const dx = Math.max(rect.left - px, 0, px - rect.right);
  const dy = Math.max(rect.top - py, 0, py - rect.bottom);
  return Math.hypot(dx, dy);
}

function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const cross = (ox: number, oy: number, px: number, py: number, qx: number, qy: number) => (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Exact distance between a segment and an axis-aligned rectangle (0 when they touch). */
function segmentRectDistance(ax: number, ay: number, bx: number, by: number, rect: Rect) {
  if (pointRectDistance(ax, ay, rect) === 0 || pointRectDistance(bx, by, rect) === 0) return 0;
  const corners: Array<[number, number]> = [
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.right, rect.bottom],
    [rect.left, rect.bottom],
  ];
  for (let edge = 0; edge < 4; edge += 1) {
    const [cx, cy] = corners[edge];
    const [dx, dy] = corners[(edge + 1) % 4];
    if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  }
  return Math.min(
    pointRectDistance(ax, ay, rect),
    pointRectDistance(bx, by, rect),
    ...corners.map(([cx, cy]) => pointSegmentDistance(cx, cy, ax, ay, bx, by)),
  );
}

/** Distance from a rectangle to the closed centre line. */
function trackDistance(centerline: TrackVariant["centerline"], rect: Rect) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < centerline.length; index += 1) {
    const a = centerline[index];
    const b = centerline[(index + 1) % centerline.length];
    best = Math.min(best, segmentRectDistance(a.x, a.y, b.x, b.y, rect));
  }
  return best;
}

/** Distance from the centre line that a decoration's footprint must keep: the asphalt edge plus a margin. */
export function trackClearance(variant: TrackVariant) {
  return variant.width / 2 + ASPHALT_MARGIN;
}

export function isOnLand(x: number, y: number) {
  return LAND_ELLIPSES.some((land) => ((x - land.x) / (land.width / 2)) ** 2 + ((y - land.y) / (land.height / 2)) ** 2 <= 1);
}

function rectOnLand(rect: Rect) {
  return isOnLand(rect.left, rect.top) && isOnLand(rect.right, rect.top) && isOnLand(rect.left, rect.bottom) && isOnLand(rect.right, rect.bottom);
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The centre must stay on the map; an edge may run off it (a pier reaching in from the map edge). */
function centreInWorld(rect: Rect) {
  const x = (rect.left + rect.right) / 2;
  const y = (rect.top + rect.bottom) / 2;
  return x >= 0 && y >= 0 && x <= WORLD_WIDTH && y <= WORLD_HEIGHT;
}

/** Unit normal of the centre-line segment nearest (x, y), pointing towards (x, y). */
function outwardNormal(centerline: TrackVariant["centerline"], x: number, y: number) {
  let best = { distance: Number.POSITIVE_INFINITY, nx: 0, ny: -1, px: x, py: y };
  for (let index = 0; index < centerline.length; index += 1) {
    const a = centerline[index];
    const b = centerline[(index + 1) % centerline.length];
    const distance = pointSegmentDistance(x, y, a.x, a.y, b.x, b.y);
    if (distance < best.distance) {
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / (length * length)));
      best = { distance, nx: -dy / length, ny: dx / length, px: a.x + t * dx, py: a.y + t * dy };
    }
  }
  let side = best.nx * (x - best.px) + best.ny * (y - best.py);
  if (Math.abs(side) < 1e-6) {
    // Sitting exactly on the line: push away from the loop's middle.
    const cx = centerline.reduce((sum, point) => sum + point.x, 0) / centerline.length;
    const cy = centerline.reduce((sum, point) => sum + point.y, 0) / centerline.length;
    side = best.nx * (best.px - cx) + best.ny * (best.py - cy);
  }
  return side < 0 ? { x: -best.nx, y: -best.ny } : { x: best.nx, y: best.ny };
}

export type PlacedDecoration = { decoration: MarinaDecoration; index: number };

/**
 * Keep decorations off the asphalt. A decoration whose drawn footprint reaches the asphalt is nudged
 * outward, perpendicular to the nearest track segment, up to NUDGE_LIMIT px. The new spot must clear
 * the asphalt and keep its centre on the map. It must not newly overlap another decoration (pairs laid out
 * together, such as a yacht at its pier, may keep touching). A prop that stood fully on land must
 * stay fully on land; quay and water props may stay off it. If no such spot exists the decoration is
 * dropped. `notes` has one line per moved or dropped decoration.
 */
export function placeDecorations(variant: TrackVariant, hasTexture: HasTexture) {
  const clearance = trackClearance(variant);
  const footprints: Array<Rect | null> = variant.decorations.map((decoration, index) =>
    rectAt(decoration.position.x, decoration.position.y, decorationSize(decoration, index, hasTexture)),
  );
  const placed: PlacedDecoration[] = [];
  const notes: string[] = [];

  variant.decorations.forEach((decoration, index) => {
    const size = decorationSize(decoration, index, hasTexture);
    const { x, y } = decoration.position;
    if (trackDistance(variant.centerline, rectAt(x, y, size)) >= clearance) {
      placed.push({ decoration, index });
      return;
    }

    const original = rectAt(x, y, size);
    const normal = outwardNormal(variant.centerline, x, y);
    const needsLand = !WATER_KINDS.has(decoration.kind) && rectOnLand(original);
    const designedNeighbours = new Set(
      footprints.flatMap((other, otherIndex) => (other !== null && otherIndex !== index && rectsOverlap(original, other) ? [otherIndex] : [])),
    );
    for (let step = NUDGE_STEP; step <= NUDGE_LIMIT; step += NUDGE_STEP) {
      const nx = Math.round(x + normal.x * step);
      const ny = Math.round(y + normal.y * step);
      const rect = rectAt(nx, ny, size);
      if (!centreInWorld(rect) || trackDistance(variant.centerline, rect) < clearance) continue;
      if (needsLand && !rectOnLand(rect)) continue;
      const blocked = footprints.some(
        (other, otherIndex) => otherIndex !== index && other !== null && !designedNeighbours.has(otherIndex) && rectsOverlap(rect, other),
      );
      if (blocked) continue;
      footprints[index] = rect;
      placed.push({ decoration: { ...decoration, position: { x: nx, y: ny } }, index });
      notes.push(`${variant.id}: ${decoration.kind} at (${x}, ${y}) moved ${step} px to (${nx}, ${ny}), off the asphalt`);
      return;
    }

    footprints[index] = null;
    notes.push(`${variant.id}: ${decoration.kind} at (${x}, ${y}) skipped: on the asphalt, no clear spot within ${NUDGE_LIMIT} px`);
  });

  return { placed, notes };
}
