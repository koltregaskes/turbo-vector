import "./styles.css";
import { createTurboVectorApp } from "./game/app";
import { initCrazyGames } from "./integrations/crazygames";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.style.setProperty(
  "--tv-menu-bg",
  `url("${new URL("assets/img/menu-bg.jpg", document.baseURI).href}")`,
);

initCrazyGames();

const searchParams = new URLSearchParams(window.location.search);

createTurboVectorApp(app, {
  autostart: searchParams.get("autostart") === "1",
  reviewMode: searchParams.get("review") === "1",
  reviewSurface: searchParams.get("surface") ?? undefined,
});
