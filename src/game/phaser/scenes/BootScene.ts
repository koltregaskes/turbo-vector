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
    this.scene.start("race");
  }
}
