import { TUNNEL_DURATION } from "../tunnel/tunnelConfig.js";

const MODES = new Set([
  "baseline",
  "noaudio",
  "novideo",
  "nopreload",
  "notics",
  "minimal",
]);

const requestedMode = new URLSearchParams(globalThis.location?.search ?? "").get("perfdebug");
const mode = MODES.has(requestedMode) ? requestedMode : null;

export const PERF_DEBUG = Object.freeze({
  enabled: mode !== null,
  mode: mode ?? "off",
  finalThirdStart: (TUNNEL_DURATION * 2) / 3,
  disableChaosAudio: mode === "noaudio" || mode === "minimal",
  disableVideo: mode === "novideo" || mode === "minimal",
  disablePreload: mode === "nopreload" || mode === "minimal",
  disableTics: mode === "notics" || mode === "minimal",
});

export function isPerfDebugFinalThird(tunnelTime) {
  return PERF_DEBUG.enabled && tunnelTime >= PERF_DEBUG.finalThirdStart;
}
