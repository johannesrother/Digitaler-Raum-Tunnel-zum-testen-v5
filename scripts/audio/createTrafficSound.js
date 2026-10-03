const TRAFFIC_URL = new URL("../../assets/sounds/Traffic.wav", import.meta.url);

// Progress-based, deliberately irregular fragments. One shared decoder is
// seeked between events, so the escalation is deterministic and inexpensive.
export const TRAFFIC_EVENTS = Object.freeze([
  { start: 5.8, end: 7.4, offset: 3.2, volume: 0.10, fadeIn: 0.45, fadeOut: 0.35 },
  { start: 10.9, end: 13.7, offset: 12.5, volume: 0.13, fadeIn: 0.8, fadeOut: 0.5 },
  { start: 17.1, end: 18.4, offset: 31.0, volume: 0.16, fadeIn: 0.15, fadeOut: 0.4 },
  { start: 21.6, end: 25.4, offset: 47.0, volume: 0.19, fadeIn: 1.15, fadeOut: 0.65 },
  { start: 28.8, end: 31.0, offset: 7.5, volume: 0.21, fadeIn: 0.25, fadeOut: 0.45 },
  { start: 34.0, end: 38.6, offset: 23.0, volume: 0.25, fadeIn: 0.75, fadeOut: 0.55 },
  { start: 40.8, end: 42.1, offset: 55.0, volume: 0.27, fadeIn: 0.1, fadeOut: 0.2 },
  { start: 42.75, end: 45.1, offset: 66.0, volume: 0.29, fadeIn: 0.16, fadeOut: 0.25 },
  { start: 45.7, end: 48.1, offset: 18.0, volume: 0.31, fadeIn: 0.14, fadeOut: 0.24 },
  { start: 48.65, end: 50.05, offset: 72.0, volume: 0.32, fadeIn: 0.1, fadeOut: 0.16 },
  { start: 50.35, end: 54.7, offset: 38.0, volume: 0.34, fadeIn: 0.08, fadeOut: 1.1 },
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

  const eventVolumeAt = (event, tunnelTime) => {
    const fadeIn = Math.min(1, (tunnelTime - event.start) / event.fadeIn);
    const fadeOut = Math.min(1, (event.end - tunnelTime) / event.fadeOut);
    const envelope = smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
    return event.volume * envelope;
  };

  return {
    update(tunnelTime) {
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
      if (exitFade) return;
      exitFade = { start: tunnelTime, duration, from: trafficAudio.volume };
      if (currentEventIndex < 0) trafficAudio.volume = 0;
    },
    stop() {
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
      };
    },
  };
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}
