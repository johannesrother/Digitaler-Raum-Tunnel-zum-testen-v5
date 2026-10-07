const SUCTION_SOUND_VOLUME = 0.8;
const SUCTION_INITIAL_VOLUME = 0.06;
const AUDIO_FADE_STEP_MS = 16;
const SUCTION_SOUND_URL = new URL(
  "../../assets/sounds/186674__katdhamphir__creepy-wind-suction.wav",
  import.meta.url,
);

export function createSuctionSound() {
  const suctionAudio = new Audio(SUCTION_SOUND_URL.href);
  suctionAudio.preload = "auto";
  suctionAudio.loop = false;
  suctionAudio.volume = SUCTION_SOUND_VOLUME;
  suctionAudio.load();
  let started = false;
  let fadeFrame = null;
  let peakStart = 0;
  let peakEnd = 1;

  const fadeOutAndStop = (duration = 2) => {
    if (!started) return;
    const from = suctionAudio.volume;
    const startedAt = performance.now();
    const update = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / (duration * 1000));
      suctionAudio.volume = from * (1 - progress);
      if (progress < 1) {
        fadeFrame = window.setTimeout(update, AUDIO_FADE_STEP_MS);
        return;
      }
      suctionAudio.pause();
      suctionAudio.currentTime = 0;
      suctionAudio.volume = SUCTION_SOUND_VOLUME;
      started = false;
      fadeFrame = null;
    };
    update();
  };

  const stop = () => {
    if (fadeFrame !== null) window.clearTimeout(fadeFrame);
    fadeFrame = null;
    started = false;
    peakStart = 0;
    peakEnd = 1;
    suctionAudio.pause();
    suctionAudio.currentTime = 0;
    suctionAudio.volume = SUCTION_SOUND_VOLUME;
  };

  return {
    start({ tunnelTime = 0, tunnelEndTime = tunnelTime + 1 } = {}) {
      if (started) return;
      started = true;
      peakStart = tunnelTime;
      peakEnd = Math.max(tunnelTime + 0.001, tunnelEndTime);
      suctionAudio.currentTime = 0;
      suctionAudio.volume = SUCTION_INITIAL_VOLUME;
      suctionAudio.play().catch(() => { started = false; });
    },
    update(tunnelTime) {
      if (!started) return;
      const progress = Math.max(0, Math.min(1,
        (tunnelTime - peakStart) / (peakEnd - peakStart)));
      const shapedProgress = progress * progress * (3 - 2 * progress);
      suctionAudio.volume = SUCTION_INITIAL_VOLUME
        + (SUCTION_SOUND_VOLUME - SUCTION_INITIAL_VOLUME) * shapedProgress;
    },
    fadeOutAndStop,
    stop,
    dispose() {
      stop();
      suctionAudio.removeAttribute("src");
      suctionAudio.load();
    },
  };
}
