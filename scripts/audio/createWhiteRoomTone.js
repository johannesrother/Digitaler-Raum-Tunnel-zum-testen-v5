const FLATLINE_FREQUENCY_HZ = 1000;
const FLATLINE_GAIN = 0.18;
const FLATLINE_DURATION_SECONDS = 8.173424;
const WHITE_ROOM_FADE_OUT_SECONDS = 5;
const FLATLINE_ATTACK_SECONDS = 0.05;
const FLATLINE_RELEASE_SECONDS = 0.03;
const AUDIO_FADE_STEP_MS = 16;

/** A single lightweight Web-Audio oscillator for the White-Room flatline. */
export function createWhiteRoomTone({ onActivate, onFadeStart, onFadeProgress, onEnded } = {}) {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  let audioContext = null;
  let oscillator = null;
  let gainNode = null;
  let unlocked = false;
  let unlocking = false;
  let activated = false;
  let playbackStarted = false;
  let fadeFrame = null;
  let returnStarted = false;
  let returnProgress = 0;
  let playbackGeneration = 0;

  const ensureAudioContext = () => {
    if (!audioContext && AudioContextClass) {
      audioContext = new AudioContextClass();
    }
    return audioContext;
  };

  const cancelFadeFrame = () => {
    if (fadeFrame !== null) window.clearTimeout(fadeFrame);
    fadeFrame = null;
  };

  const disconnectNodes = () => {
    oscillator?.disconnect();
    gainNode?.disconnect();
    oscillator = null;
    gainNode = null;
  };

  const stopNodes = ({ release = false } = {}) => {
    const activeOscillator = oscillator;
    const activeGain = gainNode;
    oscillator = null;
    gainNode = null;
    if (!activeOscillator || !activeGain || !audioContext) {
      activeOscillator?.disconnect();
      activeGain?.disconnect();
      return;
    }

    activeOscillator.onended = null;
    const now = audioContext.currentTime;
    const releaseDuration = release ? FLATLINE_RELEASE_SECONDS : 0;
    if (typeof activeGain.gain.cancelAndHoldAtTime === "function") {
      activeGain.gain.cancelAndHoldAtTime(now);
    } else {
      const currentGain = activeGain.gain.value;
      activeGain.gain.cancelScheduledValues(now);
      activeGain.gain.setValueAtTime(currentGain, now);
    }
    activeGain.gain.linearRampToValueAtTime(0, now + releaseDuration);
    try {
      activeOscillator.stop(now + releaseDuration);
    } catch {
      activeOscillator.disconnect();
      activeGain.disconnect();
      return;
    }
    activeOscillator.onended = () => {
      activeOscillator.disconnect();
      activeGain.disconnect();
    };
  };

  const applyReturnFade = (progress) => {
    if (!returnStarted) {
      returnStarted = true;
      // Prepare the initial scene while the existing white blend is still 1.
      onFadeStart?.();
    }
    returnProgress = Math.max(returnProgress, progress);
    onFadeProgress?.(returnProgress);
  };

  const finishPlayback = (generation) => {
    if (!activated || !playbackStarted || generation !== playbackGeneration) return;
    cancelFadeFrame();
    applyReturnFade(1);
    activated = false;
    playbackStarted = false;
    disconnectNodes();
    onEnded?.();
  };

  const unlock = async () => {
    if (unlocked || unlocking) return;
    const context = ensureAudioContext();
    if (!context) return;
    unlocking = true;
    try {
      if (context.state !== "running") await context.resume();
      unlocked = context.state === "running";
      if (unlocked) removeUnlockListeners();
    } catch {
      unlocked = false;
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
    activate({ fadeInDuration = 0 } = {}) {
      if (activated) return;
      activated = true;
      playbackStarted = false;
      returnStarted = false;
      returnProgress = 0;
      const generation = ++playbackGeneration;
      cancelFadeFrame();
      stopNodes();

      const context = ensureAudioContext();
      if (!context) {
        activated = false;
        console.error("WHITE ROOM AUDIO ERROR: Web Audio is unavailable.");
        return;
      }

      const startFlatline = async () => {
        if (context.state !== "running") await context.resume();
        if (!activated || generation !== playbackGeneration) return;

        const startedAt = context.currentTime;
        const attackDuration = Math.min(
          Math.max(fadeInDuration, FLATLINE_ATTACK_SECONDS),
          FLATLINE_ATTACK_SECONDS + 0.01,
        );
        const fadeStart = FLATLINE_DURATION_SECONDS - WHITE_ROOM_FADE_OUT_SECONDS;
        oscillator = context.createOscillator();
        gainNode = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(FLATLINE_FREQUENCY_HZ, startedAt);
        gainNode.gain.setValueAtTime(0, startedAt);
        gainNode.gain.linearRampToValueAtTime(FLATLINE_GAIN, startedAt + attackDuration);
        gainNode.gain.setValueAtTime(FLATLINE_GAIN, startedAt + fadeStart);
        gainNode.gain.linearRampToValueAtTime(0, startedAt + FLATLINE_DURATION_SECONDS);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.onended = () => finishPlayback(generation);
        oscillator.start(startedAt);
        oscillator.stop(startedAt + FLATLINE_DURATION_SECONDS);
        playbackStarted = true;
        onActivate?.();

        const update = () => {
          if (!activated || generation !== playbackGeneration) return;
          const elapsed = context.currentTime - startedAt;
          if (elapsed >= fadeStart) {
            const progress = Math.min(1, (elapsed - fadeStart) / WHITE_ROOM_FADE_OUT_SECONDS);
            applyReturnFade(progress * progress * (3 - 2 * progress));
          }
          fadeFrame = window.setTimeout(update, AUDIO_FADE_STEP_MS);
        };
        update();
      };

      startFlatline().catch((error) => {
        if (generation !== playbackGeneration) return;
        activated = false;
        playbackStarted = false;
        stopNodes();
        console.error("WHITE ROOM AUDIO ERROR:", error);
      });
    },
    deactivate() {
      playbackGeneration++;
      cancelFadeFrame();
      activated = false;
      playbackStarted = false;
      returnStarted = false;
      returnProgress = 0;
      stopNodes({ release: true });
    },
    dispose() {
      removeUnlockListeners();
      this.deactivate();
      const context = audioContext;
      audioContext = null;
      if (context && context.state !== "closed") {
        context.close().catch(() => {});
      }
    },
  };
}
