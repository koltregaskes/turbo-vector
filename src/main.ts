import "./styles.css";
import { createTurboVectorApp } from "./game/app";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const searchParams = new URLSearchParams(window.location.search);

createTurboVectorApp(app, {
  autostart: searchParams.get("autostart") === "1",
  reviewMode: searchParams.get("review") === "1",
  reviewSurface: searchParams.get("surface") ?? undefined,
});
