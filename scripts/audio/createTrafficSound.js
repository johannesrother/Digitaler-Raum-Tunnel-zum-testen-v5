import { PERF_DEBUG, isPerfDebugFinalThird } from "../debug/performanceDebug.js";

const TRAFFIC_URL = new URL("../../assets/sounds/Traffic.wav", import.meta.url);

// Progress-based, deliberately irregular fragments. One shared decoder is
// seeked between events, so the escalation is deterministic and inexpensive.
export const TRAFFIC_EVENTS = Object.freeze([
  { start: 5.8, end: 7.4, offset: 3.2, volume: 0.10, fadeIn: 0.45, fadeOut: 0.35 },
  { start: 10.9, end: 13.7, offset: 12.5, volume: 0.13, fadeIn: 0.8, fadeOut: 0.5 },
  { start: 17.1, end: 18.4, offset: 31.0, volume: 0.16, fadeIn: 0.15, fadeOut: 0.4 },
  { start: 21.2, end: 25.4, offset: 47.0, volume: 0.19, fadeIn: 0.9, fadeOut: 0.55 },
  { start: 27.8, end: 31.4, offset: 7.5, volume: 0.22, fadeIn: 0.22, fadeOut: 0.38 },
  { start: 33.2, end: 39.0, offset: 23.0, volume: 0.26, fadeIn: 0.55, fadeOut: 0.42 },
  { start: 40.5, end: 42.2, offset: 55.0, volume: 0.28, fadeIn: 0.085, fadeOut: 0.17 },
  { start: 42.65, end: 45.25, offset: 66.0, volume: 0.30, fadeIn: 0.13, fadeOut: 0.21 },
  { start: 45.6, end: 48.2, offset: 18.0, volume: 0.32, fadeIn: 0.11, fadeOut: 0.2 },
  { start: 48.55, end: 50.15, offset: 72.0, volume: 0.33, fadeIn: 0.08, fadeOut: 0.14 },
  { start: 50.3, end: 54.7, offset: 38.0, volume: 0.34, fadeIn: 0.065, fadeOut: 1.1 },
  { start: 54.73, end: 55.62, offset: 62.0, volume: 0.32, fadeIn: 0.025, fadeOut: 0.05 },
  { start: 55.66, end: 56.55, offset: 15.0, volume: 0.31, fadeIn: 0.025, fadeOut: 0.05 },
  { start: 56.58, end: 57.48, offset: 43.0, volume: 0.32, fadeIn: 0.02, fadeOut: 0.045 },
  { start: 57.5, end: 58.35, offset: 26.0, volume: 0.30, fadeIn: 0.02, fadeOut: 0.04 },
  { start: 58.37, end: 59.18, offset: 68.0, volume: 0.28, fadeIn: 0.018, fadeOut: 0.1 },
]);

/** A single reusable HTML-audio source driven by authoritative tunnel progress. */
export function createTrafficSound() {
  const trafficAudio = new Audio(TRAFFIC_URL.href);
  trafficAudio.preload = "auto";
  trafficAudio.loop = false;
  trafficAudio.volume = 0;
  trafficAudio.load();

  let currentEventIndex = -1;
  let playbackGeneration = 0;
  let unlocked = false;
  let unlocking = false;
  let exitFade = null;
  let nextEventIndex = 0;
  let performanceSuspended = false;

  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  const unlock = async () => {
    if (unlocked || unlocking || currentEventIndex >= 0) return;
    unlocking = true;
    const generation = playbackGeneration;
    try {
      trafficAudio.volume = 0;
      await trafficAudio.play();
      if (currentEventIndex >= 0 || generation !== playbackGeneration) return;
      trafficAudio.pause();
      trafficAudio.currentTime = 0;
      unlocked = true;
      removeUnlockListeners();
    } catch {
      // The next real start gesture can retry without affecting the timeline.
    } finally {
      unlocking = false;
    }
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("click", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  const stopFragment = ({ rewind = false } = {}) => {
    playbackGeneration += 1;
    currentEventIndex = -1;
    trafficAudio.volume = 0;
    trafficAudio.pause();
    if (rewind) trafficAudio.currentTime = 0;
  };

  const startFragment = (index) => {
    const event = TRAFFIC_EVENTS[index];
    stopFragment();
    currentEventIndex = index;
    trafficAudio.currentTime = event.offset;
    trafficAudio.volume = 0;
    const generation = ++playbackGeneration;
    trafficAudio.play().catch((error) => {
      if (generation !== playbackGeneration) return;
      currentEventIndex = -1;
      console.error("TRAFFIC AUDIO ERROR:", error);
    });
  };

  const suspendForDiagnostics = () => {
    if (performanceSuspended) return;
    performanceSuspended = true;
    exitFade = null;
    stopFragment();
  };

  const eventVolumeAt = (event, tunnelTime) => {
    const fadeIn = Math.min(1, (tunnelTime - event.start) / event.fadeIn);
    const fadeOut = Math.min(1, (event.end - tunnelTime) / event.fadeOut);
    const envelope = smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
    return event.volume * envelope;
  };

  return {
    update(tunnelTime) {
      if (PERF_DEBUG.disableChaosAudio && isPerfDebugFinalThird(tunnelTime)) {
        suspendForDiagnostics();
        return;
      }
      if (exitFade) {
        const progress = Math.min(1, Math.max(0,
          (tunnelTime - exitFade.start) / exitFade.duration));
        trafficAudio.volume = exitFade.from * (1 - smoothstep(progress));
        if (progress >= 1) stopFragment();
        return;
      }

      while (nextEventIndex < TRAFFIC_EVENTS.length
        && tunnelTime >= TRAFFIC_EVENTS[nextEventIndex].end) {
        if (currentEventIndex === nextEventIndex) stopFragment();
        nextEventIndex += 1;
      }
      const event = TRAFFIC_EVENTS[nextEventIndex];
      if (!event || tunnelTime < event.start) {
        if (currentEventIndex >= 0) stopFragment();
        return;
      }
      const eventIndex = nextEventIndex;
      if (currentEventIndex !== eventIndex) startFragment(eventIndex);
      trafficAudio.volume = eventVolumeAt(event, tunnelTime);
    },
    beginExitFade(tunnelTime, duration = 2.2) {
      if (performanceSuspended) return;
      if (exitFade) return;
      exitFade = { start: tunnelTime, duration, from: trafficAudio.volume };
      if (currentEventIndex < 0) trafficAudio.volume = 0;
    },
    stop() {
      performanceSuspended = false;
      exitFade = null;
      nextEventIndex = 0;
      stopFragment({ rewind: true });
    },
    dispose() {
      removeUnlockListeners();
      this.stop();
      trafficAudio.removeAttribute("src");
      trafficAudio.load();
    },
    getDebugState() {
      return {
        currentEventIndex,
        playing: !trafficAudio.paused,
        currentTime: trafficAudio.currentTime,
        volume: trafficAudio.volume,
        exitFading: exitFade !== null,
        performanceSuspended,
      };
    },
  };
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}
