export const TUNNEL_SOUND_VOLUME = 0.8;

const AUDIO_FADE_STEP_MS = 16;
const TUNNEL_SOUND_URL = new URL(
  "../../assets/sounds/667735__theojt__mysterious-ambiance-music.wav",
  import.meta.url,
);

/** A single global HTML audio element for the tunnel soundtrack. */
export function createTunnelSound() {
  const tunnelAudio = new Audio(TUNNEL_SOUND_URL.href);
  tunnelAudio.preload = "auto";
  tunnelAudio.loop = false;
  tunnelAudio.volume = TUNNEL_SOUND_VOLUME;
  tunnelAudio.load();
  console.info("TUNNEL WAV URL:", TUNNEL_SOUND_URL.href);

  let unlocked = false;
  let unlocking = false;
  let started = false;
  let watchdogTimer = null;
  let resumePending = false;
  let lastPlaybackTime = 0;
  let stalledChecks = 0;
  let fadeInFrame = null;
  let volumeFadeFrame = null;
  let stopTimer = null;
  let playbackGeneration = 0;

  const cancelFades = () => {
    if (fadeInFrame !== null) window.clearTimeout(fadeInFrame);
    if (volumeFadeFrame !== null) window.clearTimeout(volumeFadeFrame);
    if (stopTimer !== null) window.clearTimeout(stopTimer);
    fadeInFrame = volumeFadeFrame = stopTimer = null;
  };

  tunnelAudio.addEventListener("canplay", () => {
    console.info("TUNNEL WAV CANPLAY");
  }, { once: true });

  const disableWatchdog = () => {
    if (watchdogTimer !== null) {
      window.clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    resumePending = false;
    stalledChecks = 0;
  };

  const stop = () => {
    // Mark the soundtrack inactive before pausing so the Safari watchdog can
    // never revive it after the White Room transition or disposal.
    started = false;
    playbackGeneration += 1;
    cancelFades();
    disableWatchdog();
    tunnelAudio.pause();
    tunnelAudio.currentTime = 0;
  };

  const fadeIn = (duration) => {
    cancelFades();
    if (duration <= 0) {
      tunnelAudio.volume = TUNNEL_SOUND_VOLUME;
      return;
    }
    const startedAt = performance.now();
    const update = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / (duration * 1000));
      tunnelAudio.volume = TUNNEL_SOUND_VOLUME * progress;
      if (progress < 1) {
        fadeInFrame = window.setTimeout(update, AUDIO_FADE_STEP_MS);
      } else {
        fadeInFrame = null;
      }
    };
    update();
  };

  const fadeTo = (target, duration) => {
    cancelFades();
    if (duration <= 0) {
      tunnelAudio.volume = target;
      return;
    }
    const from = tunnelAudio.volume;
    const startedAt = performance.now();
    const update = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / (duration * 1000));
      tunnelAudio.volume = from + (target - from) * progress;
      if (progress < 1) {
        volumeFadeFrame = window.setTimeout(update, AUDIO_FADE_STEP_MS);
      } else {
        volumeFadeFrame = null;
      }
    };
    update();
  };

  const resumePlayback = () => {
    const beforeFileEnd = !Number.isFinite(tunnelAudio.duration)
      || tunnelAudio.currentTime < tunnelAudio.duration - 0.1;
    if (!started || resumePending || tunnelAudio.ended || !beforeFileEnd) {
      return;
    }
    resumePending = true;
    const generation = playbackGeneration;
    tunnelAudio.play().then(() => {
      if (generation !== playbackGeneration || !started) return;
      console.info("TUNNEL AUDIO RESUMED");
    }).catch((error) => {
      if (generation !== playbackGeneration) return;
      console.error("TUNNEL AUDIO RESUME ERROR", error);
    }).finally(() => {
      if (generation === playbackGeneration) resumePending = false;
    });
  };

  const enableWatchdog = () => {
    if (watchdogTimer !== null) {
      return;
    }
    lastPlaybackTime = tunnelAudio.currentTime;
    watchdogTimer = window.setInterval(() => {
      if (!started || tunnelAudio.ended) {
        disableWatchdog();
        return;
      }
      const currentTime = tunnelAudio.currentTime;
      const hasStoppedProgressing = !tunnelAudio.paused
        && tunnelAudio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
        && Math.abs(currentTime - lastPlaybackTime) < 0.02;
      stalledChecks = hasStoppedProgressing ? stalledChecks + 1 : 0;
      if (tunnelAudio.paused || stalledChecks >= 2) {
        resumePlayback();
      }
      lastPlaybackTime = currentTime;
    }, 1000);
  };

  const onPause = () => {
    if (!started) {
      return;
    }
    console.info("TUNNEL AUDIO SAFARI PAUSED");
    resumePlayback();
  };

  const onStalled = () => {
    if (!started) {
      return;
    }
    console.info("TUNNEL AUDIO SAFARI STALLED");
    resumePlayback();
  };

  const onPlaying = () => {
    lastPlaybackTime = tunnelAudio.currentTime;
    stalledChecks = 0;
  };

  const onEnded = () => {
    started = false;
    disableWatchdog();
  };

  const onError = () => {
    if (started) {
      console.error("TUNNEL AUDIO RESUME ERROR", tunnelAudio.error);
    }
  };

  tunnelAudio.addEventListener("pause", onPause);
  tunnelAudio.addEventListener("stalled", onStalled);
  tunnelAudio.addEventListener("suspend", onStalled);
  tunnelAudio.addEventListener("waiting", onStalled);
  tunnelAudio.addEventListener("playing", onPlaying);
  tunnelAudio.addEventListener("ended", onEnded);
  tunnelAudio.addEventListener("error", onError);

  const unlock = async () => {
    if (unlocked || unlocking || started) {
      return;
    }
    unlocking = true;
    const generation = playbackGeneration;
    try {
      // This runs only as part of the first real user interaction. It makes
      // later playback at the spatial Rift crossing eligible for autoplay.
      tunnelAudio.volume = 0;
      await tunnelAudio.play();
      if (started || generation !== playbackGeneration) return;
      tunnelAudio.pause();
      tunnelAudio.currentTime = 0;
      tunnelAudio.volume = TUNNEL_SOUND_VOLUME;
      unlocked = true;
      removeUnlockListeners();
    } catch (error) {
      if (!started && generation === playbackGeneration) tunnelAudio.volume = TUNNEL_SOUND_VOLUME;
    } finally {
      unlocking = false;
    }
  };

  const removeUnlockListeners = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("click", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  return {
    start({ fadeInDuration = 0 } = {}) {
      if (started) {
        return;
      }
      started = true;
      cancelFades();
      const generation = ++playbackGeneration;
      tunnelAudio.currentTime = 0;
      tunnelAudio.volume = fadeInDuration > 0 ? 0 : TUNNEL_SOUND_VOLUME;
      tunnelAudio.play().then(() => {
        if (!started || generation !== playbackGeneration) return;
        console.info("TUNNEL WAV PLAY OK");
        enableWatchdog();
        fadeIn(fadeInDuration);
      }).catch((error) => {
        if (generation !== playbackGeneration) return;
        started = false;
        console.error("TUNNEL WAV ERROR:", error);
      });
    },
    fadeTo,
    fadeOutAndStop(duration = 2) {
      fadeTo(0, duration);
      if (duration <= 0) stop();
      else stopTimer = window.setTimeout(stop, duration * 1000);
    },
    stop,
    dispose() {
      removeUnlockListeners();
      stop();
      tunnelAudio.removeEventListener("pause", onPause);
      tunnelAudio.removeEventListener("stalled", onStalled);
      tunnelAudio.removeEventListener("suspend", onStalled);
      tunnelAudio.removeEventListener("waiting", onStalled);
      tunnelAudio.removeEventListener("playing", onPlaying);
      tunnelAudio.removeEventListener("ended", onEnded);
      tunnelAudio.removeEventListener("error", onError);
      tunnelAudio.removeAttribute("src");
      tunnelAudio.load();
    },
    getDebugState() {
      return { unlocked, playing: !tunnelAudio.paused, volume: tunnelAudio.volume };
    },
  };
}
