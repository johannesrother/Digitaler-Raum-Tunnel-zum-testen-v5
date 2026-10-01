const VOICES_VOLUME = 0.38;
const VOICES_FADE_IN_SECONDS = 1.5;
const AUDIO_FADE_STEP_MS = 16;
const VOICES_URL = new URL("../../assets/sounds/Voices.wav", import.meta.url);

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
    voicesAudio.volume = VOICES_VOLUME;
  };
  voicesAudio.addEventListener("ended", onEnded);

  const stop = () => {
    playbackGeneration += 1;
    active = false;
    cancelFade();
    voicesAudio.pause();
    voicesAudio.currentTime = 0;
    voicesAudio.volume = VOICES_VOLUME;
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
    fadeOutAndStop(duration = 1.5) {
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
      };
    },
  };
}
