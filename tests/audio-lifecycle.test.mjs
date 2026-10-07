import test from 'node:test';
import assert from 'node:assert/strict';
import { createTunnelSound } from '../scripts/audio/createTunnelSound.js';
import { createIdyllSound } from '../scripts/audio/createIdyllSound.js';

// Exercise real controllers, including delayed play promises, without media
// devices. Browser playback/ended events are checked separately in the audit.
function harness() {
  let now = 0, id = 0;
  const timers = new Map(), media = [];
  const originals = { window: globalThis.window, Audio: globalThis.Audio,
    performance: globalThis.performance, HTMLMediaElement: globalThis.HTMLMediaElement };
  globalThis.performance = { now: () => now };
  globalThis.HTMLMediaElement = { HAVE_FUTURE_DATA: 3 };
  globalThis.window = {
    setTimeout(fn, ms) { timers.set(++id, { fn, at: now + ms }); return id; },
    clearTimeout(key) { timers.delete(key); },
    setInterval(fn, ms) { timers.set(++id, { fn, at: now + ms, every: ms }); return id; },
    clearInterval(key) { timers.delete(key); },
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.Audio = class extends EventTarget {
    constructor(src) { super(); Object.assign(this, { src, paused: true, currentTime: 0,
      duration: 115, ended: false, readyState: 4, volume: 1, requests: [] }); media.push(this); }
    play() { this.paused = false; return new Promise((resolve, reject) => this.requests.push({resolve, reject})); }
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
    load() {} removeAttribute() {}
  };
  return { media, timers,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
        if (!next) break;
        const [key,t] = next; now = t.at;
        if (t.every) t.at += t.every; else timers.delete(key);
        t.fn();
      }
      now = end;
    },
    restore() { for (const [key,value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    } },
  };
}

test('a previous tunnel fade-stop cannot stop a restarted run', async () => {
  const h = harness();
  try {
    const sound = createTunnelSound(), audio = h.media[0];
    sound.start(); audio.requests[0].resolve(); await Promise.resolve();
    sound.fadeOutAndStop(2); h.advance(500); sound.stop();
    sound.start(); audio.requests[1].resolve(); await Promise.resolve();
    h.advance(3000);
    assert.equal(audio.paused, false); assert.equal(audio.volume, 0.8);
    sound.dispose(); assert.equal(h.timers.size, 0);
  } finally { h.restore(); }
});

test('late tunnel play completion cannot rearm watchdog or fade after stop', async () => {
  const h = harness();
  try {
    const sound = createTunnelSound(), audio = h.media[0];
    sound.start({fadeInDuration: 2}); sound.stop();
    audio.requests[0].resolve(); await Promise.resolve();
    assert.equal(h.timers.size, 0); assert.equal(audio.paused, true);
    sound.dispose();
  } finally { h.restore(); }
});

test('replacement volume fade cancels older fade and delayed stop', async () => {
  const h = harness();
  try {
    const sound = createTunnelSound(), audio = h.media[0];
    sound.start({fadeInDuration: 4}); audio.requests[0].resolve(); await Promise.resolve();
    h.advance(500); sound.fadeOutAndStop(2); h.advance(500);
    sound.fadeTo(0.28, 1); h.advance(5000);
    assert.equal(audio.volume, 0.28); assert.equal(audio.paused, false);
    sound.fadeOutAndStop(0); assert.equal(audio.paused, true);
    sound.dispose(); assert.equal(h.timers.size, 0);
  } finally { h.restore(); }
});

test('old tunnel rejection does not change new run state', async () => {
  const h = harness();
  try {
    const sound = createTunnelSound(), audio = h.media[0];
    sound.start(); sound.stop(); sound.start();
    audio.requests[0].reject(new Error('old run')); await Promise.resolve(); await Promise.resolve();
    audio.requests[1].resolve(); await Promise.resolve();
    sound.start(); assert.equal(audio.requests.length, 2);
    sound.dispose();
  } finally { h.restore(); }
});

test('idyll start is single-flight and stale completion cannot block next run', async () => {
  const h = harness();
  try {
    const sound = createIdyllSound(), audio = h.media[0];
    sound.start(); sound.start(); assert.equal(audio.requests.length, 1);
    sound.stop(); audio.requests[0].resolve(); await Promise.resolve();
    sound.start(); assert.equal(audio.requests.length, 2);
    audio.requests[1].resolve(); await Promise.resolve();
    sound.start(); assert.equal(audio.requests.length, 2);
    sound.dispose(); assert.equal(h.timers.size, 0);
  } finally { h.restore(); }
});
