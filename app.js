const canvas = document.getElementById("trackCanvas");
const ctx = canvas.getContext("2d");

const speedValue = document.getElementById("speedValue");
const lapValue = document.getElementById("lapValue");
const bestLapValue = document.getElementById("bestLapValue");
const currentLapValue = document.getElementById("currentLapValue");

const track = {
  outer: { x: 90, y: 80, w: 780, h: 480, r: 160 },
  inner: { x: 265, y: 205, w: 430, h: 230, r: 90 },
};

const startLine = { x: 480, y: 558, w: 110, h: 10 };
const keys = new Set();

const state = {
  car: { x: 510, y: 520, angle: -Math.PI / 2, speed: 0 },
  lap: 1,
  bestLapMs: null,
  lapStart: performance.now(),
  crossedTop: false,
};

function roundedRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pointInRoundedRect(px, py, rect) {
  const cx = Math.max(rect.x + rect.r, Math.min(px, rect.x + rect.w - rect.r));
  const cy = Math.max(rect.y + rect.r, Math.min(py, rect.y + rect.h - rect.r));
  const dx = px - cx;
  const dy = py - cy;
  if (px >= rect.x + rect.r && px <= rect.x + rect.w - rect.r) {
    return py >= rect.y && py <= rect.y + rect.h;
  }
  if (py >= rect.y + rect.r && py <= rect.y + rect.h - rect.r) {
    return px >= rect.x && px <= rect.x + rect.w;
  }
  return dx * dx + dy * dy <= rect.r * rect.r;
}

function onTrack(x, y) {
  return pointInRoundedRect(x, y, track.outer) && !pointInRoundedRect(x, y, track.inner);
}

function resetCar() {
  state.car.x = 510;
  state.car.y = 520;
  state.car.angle = -Math.PI / 2;
  state.car.speed = 0;
}

function update(dt) {
  const accelerate = keys.has("ArrowUp") || keys.has("w");
  const brake = keys.has("ArrowDown") || keys.has("s");
  const left = keys.has("ArrowLeft") || keys.has("a");
  const right = keys.has("ArrowRight") || keys.has("d");

  if (accelerate) state.car.speed += 270 * dt;
  if (brake) state.car.speed -= 340 * dt;
  state.car.speed *= onTrack(state.car.x, state.car.y) ? 0.992 : 0.962;
  state.car.speed = Math.max(-90, Math.min(420, state.car.speed));

  const steerStrength = (0.015 + Math.abs(state.car.speed) * 0.00011) * (state.car.speed >= 0 ? 1 : -0.6);
  if (left) state.car.angle -= steerStrength * 60 * dt;
  if (right) state.car.angle += steerStrength * 60 * dt;

  state.car.x += Math.cos(state.car.angle) * state.car.speed * dt;
  state.car.y += Math.sin(state.car.angle) * state.car.speed * dt;

  if (!onTrack(state.car.x, state.car.y)) {
    state.car.speed *= 0.96;
  }

  if (state.car.y < 150) state.crossedTop = true;
  if (state.crossedTop && state.car.y > startLine.y && state.car.x > startLine.x && state.car.x < startLine.x + startLine.w) {
    const lapTime = performance.now() - state.lapStart;
    if (!state.bestLapMs || lapTime < state.bestLapMs) state.bestLapMs = lapTime;
    state.lap += 1;
    state.lapStart = performance.now();
    state.crossedTop = false;
  }
}

function drawTrack() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0d442e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  roundedRectPath(track.outer.x, track.outer.y, track.outer.w, track.outer.h, track.outer.r);
  ctx.fillStyle = "#2b313b";
  ctx.fill();

  roundedRectPath(track.inner.x, track.inner.y, track.inner.w, track.inner.h, track.inner.r);
  ctx.fillStyle = "#0f583a";
  ctx.fill();

  ctx.save();
  ctx.setLineDash([18, 14]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  roundedRectPath(track.outer.x + 28, track.outer.y + 28, track.outer.w - 56, track.outer.h - 56, track.outer.r - 28);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 8; i += 1) {
    ctx.fillRect(startLine.x + i * 14, startLine.y, 8, startLine.h);
  }
}

function drawCar() {
  ctx.save();
  ctx.translate(state.car.x, state.car.y);
  ctx.rotate(state.car.angle);
  ctx.fillStyle = "#ff735a";
  ctx.fillRect(-14, -24, 28, 48);
  ctx.fillStyle = "#ffd34d";
  ctx.fillRect(-10, -16, 20, 16);
  ctx.restore();
}

function render() {
  drawTrack();
  drawCar();
  speedValue.textContent = `${Math.max(0, Math.round(Math.abs(state.car.speed)))} km/h`;
  lapValue.textContent = `${state.lap}`;
  currentLapValue.textContent = `${((performance.now() - state.lapStart) / 1000).toFixed(1)}s`;
  bestLapValue.textContent = state.bestLapMs ? `${(state.bestLapMs / 1000).toFixed(1)}s` : "--";
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.key.toLowerCase() === "r") {
    resetCar();
    state.lap = 1;
    state.bestLapMs = null;
    state.lapStart = performance.now();
    state.crossedTop = false;
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key));

resetCar();
render();
requestAnimationFrame(frame);
