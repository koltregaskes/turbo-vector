import Phaser from "phaser";
import type { RaceRenderSnapshot, TrackVariant } from "../../types";

type RaceSceneBridge = {
  advance: (deltaSeconds: number) => void;
  getSnapshot: () => RaceRenderSnapshot | null;
};

type CarView = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
};

const WORLD_WIDTH = 2200;
const WORLD_HEIGHT = 1400;

function colorToNumber(hex: string) {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function getPalette(ambience: TrackVariant["ambience"]) {
  if (ambience === "sunrise") {
    return {
      water: "#3aa6cc",
      waterEdge: "#6ecce4",
      land: "#1d7d63",
      infield: "#2c9b75",
      asphalt: "#2a313b",
      lane: "#f7f2df",
      curbA: "#ff654f",
      curbB: "#fff4db",
      structure: "#253849",
      pier: "#73593d",
      light: "#ffe9a5",
      sky: "#88d0ff",
    };
  }

  if (ambience === "golden") {
    return {
      water: "#2d8cb2",
      waterEdge: "#5ebcd7",
      land: "#226f54",
      infield: "#3d9468",
      asphalt: "#2b3038",
      lane: "#f6ead0",
      curbA: "#ff6f4f",
      curbB: "#fff1d2",
      structure: "#304254",
      pier: "#6a5137",
      light: "#ffd28c",
      sky: "#f8b16c",
    };
  }

  return {
    water: "#183d66",
    waterEdge: "#2f6ea0",
    land: "#1d544d",
    infield: "#2d7f60",
    asphalt: "#232831",
    lane: "#e9eef5",
    curbA: "#ff6f59",
    curbB: "#fff6eb",
    structure: "#2d3c4d",
    pier: "#584531",
    light: "#ffe6a8",
    sky: "#0f1731",
  };
}

export class RaceScene extends Phaser.Scene {
  private readonly bridge: RaceSceneBridge;
  private readonly carViews = new Map<string, CarView>();
  private backgroundLayer!: Phaser.GameObjects.Graphics;
  private trackLayer!: Phaser.GameObjects.Graphics;
  private decorationLayer!: Phaser.GameObjects.Graphics;
  private hazardLayer!: Phaser.GameObjects.Graphics;
  private countdownLabel!: Phaser.GameObjects.Text;
  private currentVariantId = "";
  private followTargetId = "";

  constructor(bridge: RaceSceneBridge) {
    super("race");
    this.bridge = bridge;
  }

  create() {
    this.cameras.main.setBackgroundColor("#08131e");
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(0.74);
    this.cameras.main.roundPixels = false;

    this.backgroundLayer = this.add.graphics();
    this.trackLayer = this.add.graphics();
    this.decorationLayer = this.add.graphics();
    this.hazardLayer = this.add.graphics();

    this.countdownLabel = this.add
      .text(0, 0, "", {
        fontFamily: "Bahnschrift, 'Roboto Condensed', 'Arial Narrow', 'Helvetica Neue', sans-serif",
        fontSize: "116px",
        fontStyle: "700",
        color: "#fff7e0",
        stroke: "#14212c",
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  private drawDecoration(graphics: Phaser.GameObjects.Graphics, decoration: TrackVariant["decorations"][number], palette: ReturnType<typeof getPalette>) {
    const tint = colorToNumber(decoration.tint ?? palette.structure);
    const { x, y } = decoration.position;

    if (decoration.kind === "building") {
      graphics.fillStyle(tint, 1);
      graphics.fillRoundedRect(x - decoration.width / 2, y - decoration.height / 2, decoration.width, decoration.height, 18);
      graphics.lineStyle(4, colorToNumber("#7fd4ff"), 0.22);
      graphics.strokeRoundedRect(x - decoration.width / 2, y - decoration.height / 2, decoration.width, decoration.height, 18);
      return;
    }

    if (decoration.kind === "pier") {
      graphics.fillStyle(colorToNumber(decoration.tint ?? palette.pier), 1);
      graphics.fillRoundedRect(x - decoration.width / 2, y - decoration.height / 2, decoration.width, decoration.height, 12);
      return;
    }

    if (decoration.kind === "grandstand") {
      graphics.fillStyle(tint, 1);
      graphics.fillRoundedRect(x - decoration.width / 2, y - decoration.height / 2, decoration.width, decoration.height, 14);
      graphics.fillStyle(colorToNumber("#b9d1e8"), 0.6);
      graphics.fillRect(x - decoration.width / 2 + 18, y - 12, decoration.width - 36, 8);
      graphics.fillRect(x - decoration.width / 2 + 18, y + 8, decoration.width - 36, 8);
      return;
    }

    if (decoration.kind === "tower") {
      graphics.fillStyle(tint, 1);
      graphics.fillRoundedRect(x - decoration.width / 2, y - decoration.height / 2, decoration.width, decoration.height, 18);
      graphics.fillStyle(colorToNumber("#93d9ff"), 0.42);
      for (let index = 0; index < 4; index += 1) {
        graphics.fillRect(x - decoration.width / 2 + 12, y - decoration.height / 2 + 18 + index * 34, decoration.width - 24, 12);
      }
      return;
    }

    if (decoration.kind === "crane") {
      graphics.fillStyle(tint, 1);
      graphics.fillRect(x - 8, y - decoration.height / 2, 16, decoration.height);
      graphics.fillRect(x - decoration.width / 2, y - decoration.height / 2 + 12, decoration.width, 12);
      graphics.fillRect(x + decoration.width / 2 - 12, y - decoration.height / 2 + 24, 12, 52);
      return;
    }

    if (decoration.kind === "lights") {
      graphics.fillStyle(colorToNumber("#2f445a"), 1);
      graphics.fillRect(x - decoration.width / 2, y - decoration.height / 2, decoration.width, decoration.height);
      graphics.fillStyle(colorToNumber(decoration.tint ?? palette.light), 0.34);
      graphics.fillCircle(x - 34, y, 24);
      graphics.fillCircle(x + 34, y, 24);
      return;
    }

    if (decoration.kind === "yacht") {
      graphics.fillStyle(tint, 1);
      graphics.fillRoundedRect(x - decoration.width / 2, y - decoration.height / 2, decoration.width, decoration.height, 20);
      graphics.fillStyle(colorToNumber("#bdd9e7"), 1);
      graphics.fillRoundedRect(x - decoration.width / 6, y - decoration.height / 2 - 6, decoration.width / 3, 12, 6);
      return;
    }

    if (decoration.kind === "palm") {
      graphics.fillStyle(colorToNumber("#70523a"), 1);
      graphics.fillRect(x - 4, y, 8, decoration.height / 2);
      graphics.fillStyle(tint, 1);
      graphics.fillCircle(x, y, decoration.width / 2);
      graphics.fillCircle(x - 14, y + 8, decoration.width / 2.7);
      graphics.fillCircle(x + 16, y + 10, decoration.width / 2.7);
    }
  }

  private drawTrack(variant: TrackVariant) {
    const palette = getPalette(variant.ambience);
    this.backgroundLayer.clear();
    this.trackLayer.clear();
    this.decorationLayer.clear();

    this.cameras.main.setBackgroundColor(palette.sky);

    this.backgroundLayer.fillStyle(colorToNumber(palette.water), 1);
    this.backgroundLayer.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.backgroundLayer.fillStyle(colorToNumber(palette.land), 1);
    this.backgroundLayer.fillEllipse(1240, 710, 1540, 1100);
    this.backgroundLayer.fillEllipse(1170, 700, 1020, 720);
    this.backgroundLayer.fillStyle(colorToNumber(palette.infield), 1);
    this.backgroundLayer.fillEllipse(1110, 710, 540, 340);
    this.backgroundLayer.fillStyle(colorToNumber(palette.waterEdge), 0.22);
    this.backgroundLayer.fillEllipse(390, 690, 500, 880);

    variant.decorations.forEach((decoration) => {
      this.drawDecoration(this.decorationLayer, decoration, palette);
    });

    const linePoints = variant.centerline;
    this.trackLayer.lineStyle(variant.width + 34, colorToNumber(palette.curbA), 1);
    this.trackLayer.beginPath();
    this.trackLayer.moveTo(linePoints[0].x, linePoints[0].y);
    linePoints.slice(1).forEach((point) => this.trackLayer.lineTo(point.x, point.y));
    this.trackLayer.closePath();
    this.trackLayer.strokePath();

    this.trackLayer.lineStyle(variant.width + 16, colorToNumber(palette.curbB), 1);
    this.trackLayer.beginPath();
    this.trackLayer.moveTo(linePoints[0].x, linePoints[0].y);
    linePoints.slice(1).forEach((point) => this.trackLayer.lineTo(point.x, point.y));
    this.trackLayer.closePath();
    this.trackLayer.strokePath();

    this.trackLayer.lineStyle(variant.width, colorToNumber(palette.asphalt), 1);
    this.trackLayer.beginPath();
    this.trackLayer.moveTo(linePoints[0].x, linePoints[0].y);
    linePoints.slice(1).forEach((point) => this.trackLayer.lineTo(point.x, point.y));
    this.trackLayer.closePath();
    this.trackLayer.strokePath();

    this.trackLayer.lineStyle(5, colorToNumber(palette.lane), 0.34);
    for (let progress = 0; progress < 2800; progress += 78) {
      const a = linePoints[progress % linePoints.length];
      const b = linePoints[(progress + 1) % linePoints.length];
      const tangent = new Phaser.Math.Vector2(b.x - a.x, b.y - a.y).normalize();
      const center = linePoints[progress % linePoints.length];
      this.trackLayer.beginPath();
      this.trackLayer.moveTo(center.x - tangent.x * 16, center.y - tangent.y * 16);
      this.trackLayer.lineTo(center.x + tangent.x * 16, center.y + tangent.y * 16);
      this.trackLayer.strokePath();
    }

    const start = linePoints[0];
    const next = linePoints[1];
    const tangent = new Phaser.Math.Vector2(next.x - start.x, next.y - start.y).normalize();
    const normal = new Phaser.Math.Vector2(-tangent.y, tangent.x);
    for (let index = 0; index < 8; index += 1) {
      const offset = -42 + index * 12;
      const centerX = start.x + tangent.x * offset;
      const centerY = start.y + tangent.y * offset;
      this.trackLayer.fillStyle(index % 2 === 0 ? colorToNumber("#ffffff") : colorToNumber("#10141a"), 1);
      this.trackLayer.fillRect(centerX - normal.x * 26, centerY - normal.y * 26, 10, 52);
    }
  }

  private ensureCarView(snapshot: RaceRenderSnapshot["cars"][number]) {
    if (this.carViews.has(snapshot.id)) {
      return this.carViews.get(snapshot.id)!;
    }

    const container = this.add.container(snapshot.x, snapshot.y);
    const shadow = this.add.ellipse(4, 6, 30, 16, 0x000000, 0.26);
    const body = this.add.ellipse(0, 0, 30, 52, colorToNumber(snapshot.color), 1);
    const stripe = this.add.rectangle(0, -8, 15, 12, colorToNumber(snapshot.accent), 1);
    const canopy = this.add.rectangle(0, 6, 13, 18, colorToNumber("#14202c"), 1);
    const rear = this.add.rectangle(0, 16, 18, 4, colorToNumber("#0c131b"), 1);
    container.add([shadow, body, stripe, canopy, rear]);
    if (snapshot.isPlayer) {
      const glow = this.add.ellipse(0, 0, 40, 62, colorToNumber("#ffdfad"), 0.08);
      container.addAt(glow, 0);
    }

    const label = this.add
      .text(snapshot.x, snapshot.y - 38, snapshot.name, {
        fontFamily: "Bahnschrift, 'Roboto Condensed', 'Arial Narrow', 'Helvetica Neue', sans-serif",
        fontSize: "18px",
        fontStyle: "700",
        color: "#f7f3ea",
        stroke: "#101418",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const view = { container, label };
    this.carViews.set(snapshot.id, view);
    return view;
  }

  private drawHazards(snapshot: RaceRenderSnapshot, timeSeconds: number) {
    const palette = getPalette(snapshot.variant.ambience);
    this.hazardLayer.clear();

    snapshot.variant.hazards.forEach((hazard, index) => {
      const pulse = 0.7 + Math.sin(timeSeconds * 2.6 + index) * 0.18;
      if (hazard.type === "oil") {
        this.hazardLayer.fillStyle(colorToNumber("#090b10"), 0.48);
        this.hazardLayer.fillEllipse(hazard.position.x, hazard.position.y, hazard.radius * 2.1 * pulse, hazard.radius * 1.5 * pulse);
      } else if (hazard.type === "barrier") {
        this.hazardLayer.fillStyle(colorToNumber("#f0ab3b"), 1);
        for (let marker = -1; marker <= 1; marker += 1) {
          this.hazardLayer.fillTriangle(
            hazard.position.x + marker * 18,
            hazard.position.y - 18,
            hazard.position.x + marker * 18 - 10,
            hazard.position.y + 14,
            hazard.position.x + marker * 18 + 10,
            hazard.position.y + 14,
          );
        }
      } else {
        this.hazardLayer.fillStyle(colorToNumber(palette.light), 0.32);
        this.hazardLayer.fillCircle(hazard.position.x, hazard.position.y, hazard.radius * pulse);
        this.hazardLayer.fillStyle(colorToNumber("#d5fdff"), 0.18);
        this.hazardLayer.fillCircle(hazard.position.x, hazard.position.y, hazard.radius * 0.55 * pulse);
      }
    });
  }

  update(time: number, delta: number) {
    this.bridge.advance(delta / 1000);
    const snapshot = this.bridge.getSnapshot();
    if (!snapshot) return;

    if (snapshot.variant.id !== this.currentVariantId) {
      this.currentVariantId = snapshot.variant.id;
      this.drawTrack(snapshot.variant);
    }

    this.drawHazards(snapshot, time / 1000);

    snapshot.cars.forEach((car) => {
      const view = this.ensureCarView(car);
      view.container.setPosition(car.x, car.y);
      view.container.setRotation(car.heading + Math.PI / 2);
      view.container.setAlpha(car.finished ? 0.86 : 1);
      view.container.setScale(car.isPlayer ? 1.08 : 1);
      view.label.setPosition(car.x, car.y - 42);
      view.label.setText(car.rank <= 3 || car.isPlayer ? `${car.rank}. ${car.name}` : "");
      view.label.setVisible(car.rank <= 3 || car.isPlayer);
    });

    if (snapshot.followTargetId !== this.followTargetId) {
      this.followTargetId = snapshot.followTargetId;
      const targetView = this.carViews.get(snapshot.followTargetId);
      if (targetView) {
        this.cameras.main.startFollow(targetView.container, true, 0.08, 0.08);
      }
    }

    const targetView = this.carViews.get(snapshot.followTargetId);
    if (targetView) {
      const rotation = targetView.container.rotation - Math.PI / 2;
      this.cameras.main.setFollowOffset(-Math.cos(rotation) * 120, -Math.sin(rotation) * 120);
    }

    this.countdownLabel.setPosition(this.scale.width / 2, this.scale.height / 2);
    if (snapshot.countdown > 0) {
      this.countdownLabel.setVisible(true);
      this.countdownLabel.setText(`${snapshot.countdown}`);
    } else {
      this.countdownLabel.setVisible(false);
    }
  }
}

