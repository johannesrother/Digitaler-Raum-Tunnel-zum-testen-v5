const VOICES_VOLUME = 0.38;
const VOICES_FADE_IN_SECONDS = 1.5;
const AUDIO_FADE_STEP_MS = 16;
const VOICES_URL = new URL("../../assets/sounds/Voices.wav", import.meta.url);

// The first full playback still belongs to the first video cut. These late,
// progress-driven fragments reuse that same element to join the final waves.
export const VOICES_LATE_EVENTS = Object.freeze([
  { start: 40.8, end: 42.0, offset: 0.4, volume: 0.22, fadeIn: 0.14, fadeOut: 0.18 },
  { start: 43.0, end: 44.8, offset: 3.1, volume: 0.24, fadeIn: 0.12, fadeOut: 0.2 },
  { start: 45.9, end: 47.6, offset: 5.5, volume: 0.26, fadeIn: 0.1, fadeOut: 0.18 },
  { start: 48.8, end: 49.95, offset: 1.8, volume: 0.28, fadeIn: 0.08, fadeOut: 0.14 },
  { start: 50.45, end: 52.1, offset: 4.0, volume: 0.30, fadeIn: 0.07, fadeOut: 0.14 },
]);

/** A short, non-looping voice layer introduced by the first tunnel video cut. */
export function createVoicesSound() {
  const voicesAudio = new Audio(VOICES_URL.href);
  voicesAudio.preload = "auto";
  voicesAudio.loop = false;
  voicesAudio.volume = VOICES_VOLUME;
  voicesAudio.load();

  let unlocked = false;
  let unlocking = false;
  let active = false;
  let fadeFrame = null;
  let playbackGeneration = 0;
  let lateEventIndex = -1;
  let nextLateEventIndex = 0;
  let ending = false;

  const cancelFade = () => {
    if (fadeFrame !== null) window.clearTimeout(fadeFrame);
    fadeFrame = null;
  };

  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  const unlock = async () => {
    if (unlocked || unlocking || active) return;
    unlocking = true;
    const generation = playbackGeneration;
    try {
      voicesAudio.volume = 0;
      await voicesAudio.play();
      if (active || generation !== playbackGeneration) return;
      voicesAudio.pause();
      voicesAudio.currentTime = 0;
      voicesAudio.volume = VOICES_VOLUME;
      unlocked = true;
      removeUnlockListeners();
    } catch {
      if (!active && generation === playbackGeneration) voicesAudio.volume = VOICES_VOLUME;
    } finally {
      unlocking = false;
    }
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("click", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  const onEnded = () => {
    if (!active) return;
    active = false;
    cancelFade();
    voicesAudio.volume = lateEventIndex >= 0 ? 0 : VOICES_VOLUME;
  };
  voicesAudio.addEventListener("ended", onEnded);

  const stop = () => {
    playbackGeneration += 1;
    active = false;
    lateEventIndex = -1;
    nextLateEventIndex = 0;
    ending = false;
    cancelFade();
    voicesAudio.pause();
    voicesAudio.currentTime = 0;
    voicesAudio.volume = VOICES_VOLUME;
  };

  const stopLateFragment = () => {
    playbackGeneration += 1;
    active = false;
    lateEventIndex = -1;
    cancelFade();
    voicesAudio.volume = 0;
    voicesAudio.pause();
  };

  const startLateFragment = (index) => {
    const event = VOICES_LATE_EVENTS[index];
    stopLateFragment();
    active = true;
    lateEventIndex = index;
    voicesAudio.currentTime = event.offset;
    const generation = ++playbackGeneration;
    voicesAudio.play().catch((error) => {
      if (generation !== playbackGeneration) return;
      active = false;
      lateEventIndex = -1;
      console.error("VOICES FRAGMENT ERROR:", error);
    });
  };

  const fadeTo = (target, duration, stopAfterFade = false) => {
    cancelFade();
    if (!active) return;
    if (duration <= 0) {
      voicesAudio.volume = target;
      if (stopAfterFade) stop();
      return;
    }
    const generation = playbackGeneration;
    const from = voicesAudio.volume;
    const startedAt = performance.now();
    const update = () => {
      if (!active || generation !== playbackGeneration) return;
      const progress = Math.min(1, (performance.now() - startedAt) / (duration * 1000));
      voicesAudio.volume = from + (target - from) * progress;
      if (progress < 1) {
        fadeFrame = window.setTimeout(update, AUDIO_FADE_STEP_MS);
      } else {
        fadeFrame = null;
        if (stopAfterFade) stop();
      }
    };
    update();
  };

  return {
    start() {
      if (active) return;
      active = true;
      ending = false;
      lateEventIndex = -1;
      cancelFade();
      voicesAudio.currentTime = 0;
      voicesAudio.volume = 0;
      const generation = ++playbackGeneration;
      voicesAudio.play().then(() => {
        if (!active || generation !== playbackGeneration) return;
        fadeTo(VOICES_VOLUME, VOICES_FADE_IN_SECONDS);
      }).catch((error) => {
        if (generation !== playbackGeneration) return;
        active = false;
        console.error("VOICES AUDIO ERROR:", error);
      });
    },
    update(tunnelTime) {
      if (ending) return;
      while (nextLateEventIndex < VOICES_LATE_EVENTS.length
        && tunnelTime >= VOICES_LATE_EVENTS[nextLateEventIndex].end) {
        if (lateEventIndex === nextLateEventIndex) stopLateFragment();
        nextLateEventIndex += 1;
      }
      const event = VOICES_LATE_EVENTS[nextLateEventIndex];
      if (!event || tunnelTime < event.start) {
        if (lateEventIndex >= 0) stopLateFragment();
        return;
      }
      const eventIndex = nextLateEventIndex;
      if (lateEventIndex !== eventIndex) startLateFragment(eventIndex);
      voicesAudio.volume = lateEventVolumeAt(event, tunnelTime);
    },
    fadeOutAndStop(duration = 1.5) {
      ending = true;
      fadeTo(0, duration, true);
    },
    stop,
    dispose() {
      removeUnlockListeners();
      stop();
      voicesAudio.removeEventListener("ended", onEnded);
      voicesAudio.removeAttribute("src");
      voicesAudio.load();
    },
    getDebugState() {
      return {
        active,
        playing: !voicesAudio.paused,
        currentTime: voicesAudio.currentTime,
        volume: voicesAudio.volume,
        lateEventIndex,
        ending,
      };
    },
  };
}

function lateEventVolumeAt(event, tunnelTime) {
  const fadeIn = Math.min(1, (tunnelTime - event.start) / event.fadeIn);
  const fadeOut = Math.min(1, (event.end - tunnelTime) / event.fadeOut);
  return event.volume * smoothstep(Math.max(0, Math.min(fadeIn, fadeOut)));
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}
