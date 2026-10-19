/**
 * CrazyGames SDK wrapper for Turbo Vector.
 *
 * The CrazyGames SDK v3 script is loaded via `index.html` on every host, so the
 * `CrazyGames` global exists locally and on GitHub Pages too, where the SDK is
 * never initialised and each call logs "CrazySDK is not initialized yet".
 * Calls are therefore gated on the page being served by, or framed inside, a
 * CrazyGames domain. Everywhere else every call here is a silent no-op.
 *
 * Lifecycle contract:
 *   - call `crazyGameplayStart()` when an actual race begins
 *   - call `crazyGameplayStop()` when the race ends, pauses, or returns to menu
 */

interface CrazyGamesGameModule {
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  happytime?: () => void;
}

interface CrazyGamesSDK {
  game?: CrazyGamesGameModule;
}

interface CrazyGamesGlobal {
  SDK?: CrazyGamesSDK;
}

declare global {
  interface Window {
    CrazyGames?: CrazyGamesGlobal;
  }
}

let gameplayActive = false;
let insideCrazyGames: boolean | null = null;

const CRAZYGAMES_HOST = /(^|\.)crazygames\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/i;

function isCrazyGamesUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return CRAZYGAMES_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** True when this page is hosted on, or framed by, a CrazyGames domain (checked once). */
function isInsideCrazyGames(): boolean {
  if (insideCrazyGames !== null) return insideCrazyGames;
  insideCrazyGames = false;
  if (typeof window === "undefined") return insideCrazyGames;
  if (CRAZYGAMES_HOST.test(window.location.hostname)) {
    insideCrazyGames = true;
  } else {
    const ancestors = Array.from(window.location.ancestorOrigins ?? []);
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      framed = true;
    }
    insideCrazyGames = ancestors.some(isCrazyGamesUrl) || (framed && isCrazyGamesUrl(document.referrer));
  }
  return insideCrazyGames;
}

function getSdk(): CrazyGamesSDK | null {
  if (typeof window === "undefined" || !isInsideCrazyGames()) return null;
  return window.CrazyGames?.SDK ?? null;
}

export function crazyGameplayStart(): void {
  if (gameplayActive) return;
  gameplayActive = true;
  try {
    getSdk()?.game?.gameplayStart?.();
  } catch (error) {
    console.warn("[crazygames] gameplayStart failed:", error);
  }
}

export function crazyGameplayStop(): void {
  if (!gameplayActive) return;
  gameplayActive = false;
  try {
    getSdk()?.game?.gameplayStop?.();
  } catch (error) {
    console.warn("[crazygames] gameplayStop failed:", error);
  }
}

export function crazyHappytime(): void {
  try {
    getSdk()?.game?.happytime?.();
  } catch (error) {
    console.warn("[crazygames] happytime failed:", error);
  }
}

export function isCrazyGamesEnvironment(): boolean {
  return getSdk() !== null;
}
