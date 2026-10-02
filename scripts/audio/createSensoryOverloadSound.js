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
  { source: "greeting", start: 18.4, end: 19.5, offset: 0.1, volume: 0.12, fadeIn: 0.1, fadeOut: 0.25 },
  { source: "noise", start: 22.0, end: 25.0, offset: 0.8, volume: 0.04, fadeIn: 0.55, fadeOut: 0.4 },
  { source: "walla", start: 26.7, end: 30.8, offset: 18.0, volume: 0.05, fadeIn: 0.9, fadeOut: 0.6 },
  { source: "demonic", start: 29.1, end: 30.7, offset: 0.25, volume: 0.13, fadeIn: 0.12, fadeOut: 0.22 },
  { source: "greeting", start: 32.9, end: 34.2, offset: 1.05, volume: 0.14, fadeIn: 0.08, fadeOut: 0.22 },
  { source: "walla", start: 35.8, end: 40.2, offset: 36.0, volume: 0.06, fadeIn: 0.75, fadeOut: 0.5 },
  { source: "noise", start: 37.7, end: 40.9, offset: 4.5, volume: 0.055, fadeIn: 0.3, fadeOut: 0.35 },
  { source: "demonic", start: 43.6, end: 45.1, offset: 0.1, volume: 0.15, fadeIn: 0.1, fadeOut: 0.2 },
  { source: "walla", start: 45.7, end: 49.1, offset: 49.0, volume: 0.07, fadeIn: 0.55, fadeOut: 0.4 },
  { source: "greeting", start: 46.5, end: 47.8, offset: 0.8, volume: 0.15, fadeIn: 0.08, fadeOut: 0.18 },
  { source: "noise", start: 48.5, end: 51.9, offset: 1.9, volume: 0.075, fadeIn: 0.22, fadeOut: 0.3 },
  { source: "walla", start: 49.2, end: 54.5, offset: 8.0, volume: 0.08, fadeIn: 0.35, fadeOut: 0.7 },
  { source: "demonic", start: 50.1, end: 51.9, offset: 0.2, volume: 0.17, fadeIn: 0.08, fadeOut: 0.18 },
  { source: "greeting", start: 51.0, end: 52.1, offset: 2.1, volume: 0.16, fadeIn: 0.08, fadeOut: 0.16 },
]);

/** Four reusable sources; all scheduling is tied to tunnel progress. */
export function createSensoryOverloadSound() {
  const channels = Object.fromEntries(Object.entries(SOURCES).map(([name, relativeUrl]) => {
    const audio = new Audio(new URL(relativeUrl, import.meta.url).href);
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = 0;
    audio.load();
    return [name, { audio, eventIndex: -1, generation: 0 }];
  }));
  let unlocked = false;
  let unlocking = false;
  let exitFade = null;

  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  const unlock = async () => {
    if (unlocked || unlocking || hasActiveChannel(channels)) return;
    unlocking = true;
    const generations = Object.fromEntries(Object.entries(channels).map(
      ([name, channel]) => [name, channel.generation],
    ));
    try {
      const results = await Promise.allSettled(Object.values(channels).map(async ({ audio }) => {
        audio.volume = 0;
        await audio.play();
      }));
      if (hasActiveChannel(channels)) return;
      Object.entries(channels).forEach(([name, channel]) => {
        if (channel.generation !== generations[name]) return;
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

  return {
    update(tunnelTime) {
      if (exitFade) {
        const progress = Math.min(1, Math.max(0,
          (tunnelTime - exitFade.start) / exitFade.duration));
        const fade = 1 - smoothstep(progress);
        Object.entries(channels).forEach(([name, channel]) => {
          channel.audio.volume = exitFade.volumes[name] * fade;
          if (progress >= 1 && channel.eventIndex >= 0) stopChannel(channel);
        });
        return;
      }

      Object.entries(channels).forEach(([source, channel]) => {
        const eventIndex = SENSORY_OVERLOAD_EVENTS.findIndex((event) => (
          event.source === source && tunnelTime >= event.start && tunnelTime < event.end
        ));
        if (eventIndex < 0) {
          if (channel.eventIndex >= 0) stopChannel(channel);
          return;
        }
        if (channel.eventIndex !== eventIndex) startChannel(channel, eventIndex);
        channel.audio.volume = eventVolumeAt(SENSORY_OVERLOAD_EVENTS[eventIndex], tunnelTime);
      });
    },
    beginExitFade(tunnelTime, duration = 2) {
      if (exitFade) return;
      exitFade = {
        start: tunnelTime,
        duration,
        volumes: Object.fromEntries(Object.entries(channels).map(
          ([name, channel]) => [name, channel.audio.volume],
        )),
      };
    },
    stop() {
      exitFade = null;
      Object.values(channels).forEach((channel) => stopChannel(channel, true));
    },
    dispose() {
      removeUnlockListeners();
      this.stop();
      Object.values(channels).forEach(({ audio }) => {
        audio.removeAttribute("src");
        audio.load();
      });
    },
    getDebugState() {
      return Object.fromEntries(Object.entries(channels).map(([name, channel]) => [name, {
        eventIndex: channel.eventIndex,
        playing: !channel.audio.paused,
        currentTime: channel.audio.currentTime,
        volume: channel.audio.volume,
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
  return Object.values(channels).some(({ eventIndex }) => eventIndex >= 0);
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}
