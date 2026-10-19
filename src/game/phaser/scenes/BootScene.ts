import Phaser from "phaser";

const CAR_COLOURS = ["red", "blue", "green", "yellow", "black"] as const;

// Kenney Racing Pack (CC0) trackside props, also in public/assets/sprites. RaceScene falls back
// to its drawn shapes for any key that fails to load.
const TRACKSIDE_SPRITES = [
  "tribune_full",
  "tribune_empty",
  "tent_red_large",
  "tent_blue_large",
  "tires_red",
  "tires_white",
  "tree_large",
  "tree_small",
  "barrier_red",
  "barrier_white",
] as const;

// The Kenney top-down tents print "RACE" on both roof slopes, so under the fixed north-up camera the
// north slope reads upside down. In the 256 px sprite that lettering sits in rows 16-27, x 42-213.
// We restamp that band from a plain roof row just above it, so only the upright south lettering stays.
const TENT_SPRITES = ["tent_red_large", "tent_blue_large"] as const;
const TENT_SPRITE_SIZE = 256;
const TENT_NORTH_LETTERING = { x: 38, y: 15, width: 180, height: 14 };
const TENT_PLAIN_ROOF_ROW = 12;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    // Kenney Racing Pack (CC0) top-down car sprites, served from public/.
    const base = new URL("assets/sprites/", document.baseURI).href;
    CAR_COLOURS.forEach((colour) => {
      this.load.image(`car_${colour}`, `${base}car_${colour}.png`);
    });
    TRACKSIDE_SPRITES.forEach((key) => {
      this.load.image(key, `${base}${key}.png`);
    });
  }

  create() {
    TENT_SPRITES.forEach((key) => this.removeUpsideDownTentLettering(key));
    this.scene.start("race");
  }

  private removeUpsideDownTentLettering(key: string) {
    if (!this.textures.exists(key)) return;
    const source = this.textures.get(key).getSourceImage();
    // Only touch the art these offsets were measured on; anything else is left as loaded.
    if (!(source instanceof HTMLImageElement) || source.width !== TENT_SPRITE_SIZE || source.height !== TENT_SPRITE_SIZE) return;

    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0);
    // Stretch one plain roof row over the lettering band; each column keeps its own roof shade.
    const band = TENT_NORTH_LETTERING;
    context.drawImage(source, band.x, TENT_PLAIN_ROOF_ROW, band.width, 1, band.x, band.y, band.width, band.height);

    this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }
}
