import { PERF_DEBUG, isPerfDebugFinalThird } from "../debug/performanceDebug.js";

const SOURCES = Object.freeze({
  walla: "../../assets/sounds/17112__dcaudio__interior-walla-many-voices-laughing-restaurant.wav",
  greeting: "../../assets/sounds/257045__jagadamba__male-voice-saying-good-day.wav",
  noise: "../../assets/sounds/502536__discordantscraps__dirty-noise-groove-1.wav",
  demonic: "../../assets/sounds/823851__jw_audio__dsgnvocl_dark-demonic-low-voice-horror-recording-5_jw-audio.wav",
});

// Low source-specific ceilings compensate for the very loud walla/noise files.
// Overlaps become denser, rather than simply louder, toward the final third.
export const SENSORY_OVERLOAD_EVENTS = Object.freeze([
  { source: "demonic", start: 8.6, end: 9.7, offset: 0.15, volume: 0.10, fadeIn: 0.12, fadeOut: 0.22 },
  { source: "walla", start: 13.2, end: 16.4, offset: 2.8, volume: 0.035, fadeIn: 0.8, fadeOut: 0.5 },
  { source: "noise", start: 16.9, end: 17.75, offset: 6.8, volume: 0.045, fadeIn: 0.08, fadeOut: 0.15 },
  { source: "greeting", start: 18.4, end: 19.5, offset: 0.1, volume: 0.12, fadeIn: 0.1, fadeOut: 0.25 },
  { source: "noise", start: 21.7, end: 25.0, offset: 0.8, volume: 0.045, fadeIn: 0.45, fadeOut: 0.36 },
  { source: "greeting", start: 24.1, end: 25.0, offset: 2.65, volume: 0.125, fadeIn: 0.07, fadeOut: 0.16 },
  { source: "walla", start: 26.4, end: 30.9, offset: 18.0, volume: 0.054, fadeIn: 0.7, fadeOut: 0.48 },
  { source: "noise", start: 28.2, end: 30.4, offset: 3.6, volume: 0.052, fadeIn: 0.18, fadeOut: 0.25 },
  { source: "demonic", start: 29.0, end: 30.7, offset: 0.2, volume: 0.13, fadeIn: 0.1, fadeOut: 0.2 },
  { source: "greeting", start: 30.05, end: 31.1, offset: 0.55, volume: 0.135, fadeIn: 0.07, fadeOut: 0.18 },
  { source: "demonic", start: 32.4, end: 33.8, offset: 0.45, volume: 0.135, fadeIn: 0.09, fadeOut: 0.18 },
  { source: "greeting", start: 32.9, end: 34.2, offset: 1.05, volume: 0.14, fadeIn: 0.08, fadeOut: 0.22 },
  { source: "walla", start: 34.7, end: 40.15, offset: 36.0, volume: 0.064, fadeIn: 0.58, fadeOut: 0.38 },
  { source: "demonic", start: 35.6, end: 36.7, offset: 0.9, volume: 0.14, fadeIn: 0.07, fadeOut: 0.15 },
  { source: "noise", start: 36.9, end: 40.15, offset: 4.5, volume: 0.06, fadeIn: 0.24, fadeOut: 0.28 },
  { source: "greeting", start: 38.0, end: 39.2, offset: 1.9, volume: 0.145, fadeIn: 0.07, fadeOut: 0.16 },
  { source: "demonic", start: 39.25, end: 40.15, offset: 0.12, volume: 0.145, fadeIn: 0.05, fadeOut: 0.12 },

  // Final-third waves: distinct offsets keep the fragments unpredictable,
  // while brief deterministic relief gaps preserve a readable escalation.
  { source: "noise", start: 40.5, end: 42.2, offset: 0.35, volume: 0.064, fadeIn: 0.1, fadeOut: 0.16 },
  { source: "greeting", start: 40.75, end: 42.15, offset: 2.25, volume: 0.15, fadeIn: 0.055, fadeOut: 0.11 },
  { source: "demonic", start: 41.15, end: 42.1, offset: 0.5, volume: 0.15, fadeIn: 0.05, fadeOut: 0.1 },

  { source: "walla", start: 42.65, end: 45.25, offset: 51.0, volume: 0.071, fadeIn: 0.2, fadeOut: 0.24 },
  { source: "demonic", start: 42.9, end: 44.8, offset: 0.05, volume: 0.155, fadeIn: 0.06, fadeOut: 0.12 },
  { source: "greeting", start: 43.45, end: 45.2, offset: 0.4, volume: 0.155, fadeIn: 0.055, fadeOut: 0.11 },
  { source: "noise", start: 44.05, end: 45.25, offset: 7.1, volume: 0.069, fadeIn: 0.08, fadeOut: 0.14 },

  { source: "noise", start: 45.6, end: 48.2, offset: 5.8, volume: 0.071, fadeIn: 0.15, fadeOut: 0.2 },
  { source: "walla", start: 45.85, end: 48.15, offset: 12.0, volume: 0.076, fadeIn: 0.15, fadeOut: 0.19 },
  { source: "greeting", start: 46.25, end: 48.15, offset: 1.45, volume: 0.158, fadeIn: 0.05, fadeOut: 0.11 },
  { source: "demonic", start: 46.85, end: 48.15, offset: 0.2, volume: 0.162, fadeIn: 0.05, fadeOut: 0.1 },

  { source: "walla", start: 48.55, end: 50.15, offset: 27.0, volume: 0.079, fadeIn: 0.12, fadeOut: 0.16 },
  { source: "noise", start: 48.55, end: 50.15, offset: 2.1, volume: 0.076, fadeIn: 0.08, fadeOut: 0.13 },
  { source: "demonic", start: 48.95, end: 50.05, offset: 0.65, volume: 0.168, fadeIn: 0.045, fadeOut: 0.09 },
  { source: "greeting", start: 49.25, end: 50.15, offset: 2.8, volume: 0.16, fadeIn: 0.045, fadeOut: 0.1 },

  { source: "noise", start: 50.3, end: 52.1, offset: 6.4, volume: 0.08, fadeIn: 0.065, fadeOut: 0.14 },
  { source: "walla", start: 50.3, end: 54.5, offset: 8.0, volume: 0.082, fadeIn: 0.075, fadeOut: 0.7 },
  { source: "demonic", start: 50.4, end: 52.05, offset: 0.18, volume: 0.175, fadeIn: 0.045, fadeOut: 0.1 },
  { source: "greeting", start: 50.55, end: 52.1, offset: 2.1, volume: 0.165, fadeIn: 0.045, fadeOut: 0.1 },

  // The final peak keeps all existing source ceilings, but compresses the
  // relief gaps and fragments each source more aggressively. The suction
  // enters underneath at 52 s and survives the clean collapse at 58.9 s.
  { source: "noise", start: 52.28, end: 53.76, offset: 0.9, volume: 0.08, fadeIn: 0.045, fadeOut: 0.09 },
  { source: "greeting", start: 52.36, end: 53.68, offset: 0.2, volume: 0.165, fadeIn: 0.04, fadeOut: 0.08 },
  { source: "demonic", start: 52.48, end: 53.72, offset: 0.34, volume: 0.175, fadeIn: 0.04, fadeOut: 0.08 },

  { source: "noise", start: 54.02, end: 55.86, offset: 5.2, volume: 0.08, fadeIn: 0.05, fadeOut: 0.1 },
  { source: "greeting", start: 54.15, end: 55.72, offset: 1.35, volume: 0.165, fadeIn: 0.04, fadeOut: 0.08 },
  { source: "demonic", start: 54.42, end: 55.66, offset: 0.72, volume: 0.175, fadeIn: 0.04, fadeOut: 0.08 },
  { source: "walla", start: 54.62, end: 56.06, offset: 22.0, volume: 0.082, fadeIn: 0.05, fadeOut: 0.1 },

  { source: "noise", start: 56.05, end: 57.43, offset: 2.7, volume: 0.08, fadeIn: 0.04, fadeOut: 0.08 },
  { source: "greeting", start: 56.12, end: 57.36, offset: 2.45, volume: 0.165, fadeIn: 0.035, fadeOut: 0.075 },
  { source: "walla", start: 56.18, end: 57.5, offset: 44.0, volume: 0.082, fadeIn: 0.04, fadeOut: 0.08 },
  { source: "demonic", start: 56.2, end: 57.42, offset: 0.1, volume: 0.175, fadeIn: 0.035, fadeOut: 0.075 },

  { source: "noise", start: 57.52, end: 58.86, offset: 6.1, volume: 0.08, fadeIn: 0.035, fadeOut: 0.16 },
  { source: "greeting", start: 57.6, end: 58.82, offset: 0.6, volume: 0.165, fadeIn: 0.035, fadeOut: 0.15 },
  { source: "walla", start: 57.66, end: 58.9, offset: 31.0, volume: 0.082, fadeIn: 0.035, fadeOut: 0.18 },
  { source: "demonic", start: 57.72, end: 58.84, offset: 0.55, volume: 0.175, fadeIn: 0.03, fadeOut: 0.14 },
]);

/** Four reusable sources; all scheduling is tied to tunnel progress. */
export function createSensoryOverloadSound() {
  const channelList = Object.entries(SOURCES).map(([name, relativeUrl]) => {
    const audio = new Audio(new URL(relativeUrl, import.meta.url).href);
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = 0;
    audio.load();
    return {
      name,
      audio,
      eventIndex: -1,
      generation: 0,
      nextEvent: 0,
      eventIndexes: SENSORY_OVERLOAD_EVENTS.reduce((indexes, event, index) => {
        if (event.source === name) indexes.push(index);
        return indexes;
      }, []),
    };
  });
  let unlocked = false;
  let unlocking = false;
  let exitFade = null;
  let performanceSuspended = false;

  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  const unlock = async () => {
    if (unlocked || unlocking || hasActiveChannel(channelList)) return;
    unlocking = true;
    const generations = channelList.map((channel) => channel.generation);
    try {
      const results = await Promise.allSettled(channelList.map(async ({ audio }) => {
        audio.volume = 0;
        await audio.play();
      }));
      if (hasActiveChannel(channelList)) return;
      channelList.forEach((channel, index) => {
        if (channel.generation !== generations[index]) return;
        channel.audio.pause();
        channel.audio.currentTime = 0;
      });
      unlocked = results.every(({ status }) => status === "fulfilled");
      if (unlocked) removeUnlockListeners();
    } catch {
      // A later genuine interaction can retry the silent unlock probe.
    } finally {
      unlocking = false;
    }
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("click", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  const stopChannel = (channel, rewind = false) => {
    channel.generation += 1;
    channel.eventIndex = -1;
    channel.audio.volume = 0;
    channel.audio.pause();
    if (rewind) channel.audio.currentTime = 0;
  };

  const startChannel = (channel, eventIndex) => {
    const event = SENSORY_OVERLOAD_EVENTS[eventIndex];
    stopChannel(channel);
    channel.eventIndex = eventIndex;
    channel.audio.currentTime = event.offset;
    channel.audio.volume = 0;
    const generation = ++channel.generation;
    channel.audio.play().catch((error) => {
      if (generation !== channel.generation) return;
      channel.eventIndex = -1;
      console.error(`SENSORY AUDIO ${event.source} ERROR:`, error);
    });
  };

  const suspendForDiagnostics = () => {
    if (performanceSuspended) return;
    performanceSuspended = true;
    exitFade = null;
    channelList.forEach((channel) => stopChannel(channel));
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
        const fade = 1 - smoothstep(progress);
        channelList.forEach((channel, index) => {
          channel.audio.volume = exitFade.volumes[index] * fade;
          if (progress >= 1 && channel.eventIndex >= 0) stopChannel(channel);
        });
        return;
      }

      channelList.forEach((channel) => {
        let eventIndex = channel.eventIndexes[channel.nextEvent];
        while (eventIndex !== undefined
          && tunnelTime >= SENSORY_OVERLOAD_EVENTS[eventIndex].end) {
          if (channel.eventIndex === eventIndex) stopChannel(channel);
          channel.nextEvent += 1;
          eventIndex = channel.eventIndexes[channel.nextEvent];
        }
        const event = eventIndex === undefined ? null : SENSORY_OVERLOAD_EVENTS[eventIndex];
        if (!event || tunnelTime < event.start) {
          if (channel.eventIndex >= 0) stopChannel(channel);
          return;
        }
        if (channel.eventIndex !== eventIndex) startChannel(channel, eventIndex);
        channel.audio.volume = eventVolumeAt(event, tunnelTime);
      });
    },
    beginExitFade(tunnelTime, duration = 2) {
      if (performanceSuspended) return;
      if (exitFade) return;
      exitFade = {
        start: tunnelTime,
        duration,
        volumes: channelList.map((channel) => channel.audio.volume),
      };
    },
    stop() {
      performanceSuspended = false;
      exitFade = null;
      channelList.forEach((channel) => {
        channel.nextEvent = 0;
        stopChannel(channel, true);
      });
    },
    dispose() {
      removeUnlockListeners();
      this.stop();
      channelList.forEach(({ audio }) => {
        audio.removeAttribute("src");
        audio.load();
      });
    },
    getDebugState() {
      return Object.fromEntries(channelList.map((channel) => [channel.name, {
        eventIndex: channel.eventIndex,
        playing: !channel.audio.paused,
        currentTime: channel.audio.currentTime,
        volume: channel.audio.volume,
        performanceSuspended,
      }]));
    },
  };
}

function eventVolumeAt(event, tunnelTime) {
  const fadeIn = Math.min(1, (tunnelTime - event.start) / event.fadeIn);
  const fadeOut = Math.min(1, (event.end - tunnelTime) / event.fadeOut);
  return event.volume * smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
}

function hasActiveChannel(channels) {
  return channels.some(({ eventIndex }) => eventIndex >= 0);
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}
