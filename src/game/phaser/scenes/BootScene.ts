import Phaser from "phaser";

const CAR_COLOURS = ["red", "blue", "green", "yellow", "black"] as const;

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
  }

  create() {
    this.scene.start("race");
  }
}
