import { getIdyllSaturation } from "../environment/createIdyllDesaturation.js";

const VIDEO_OPACITY = 0.66;
const START_VIDEO = 12;
const QUEST_VIDEO_NUMBERS = new Set([2, 25, 16]);
const USE_QUEST_VIDEO_ASSETS = /OculusBrowser|Quest/i.test(navigator.userAgent);

/** Reuses one full-shell material mapping with at most current + prepared video. */
export function createTunnelVideoSkin(scene, material) {
  let currentSource = createVideoSource(scene, START_VIDEO);
  let preparedSource = null;
  let requestedSwitch = null;
  let active = false;
  let tunnelTime = 0;
  let generation = 0;

  class TunnelVideoSkinPlugin extends BABYLON.MaterialPluginBase {
    constructor() {
      super(material, "TunnelVideoSkin", 210, {}, true, true);
    }

    getClassName() { return "TunnelVideoSkinPlugin"; }

    getSamplers(samplers) {
      samplers.push("tunnelVideoSampler");
    }

    getActiveTextures(textures) {
      textures.push(currentSource.texture);
      if (preparedSource) textures.push(preparedSource.texture);
    }

    hasTexture(candidate) {
      return candidate === currentSource.texture || candidate === preparedSource?.texture;
    }

    getUniforms() {
      return {
        ubo: [{ name: "tunnelVideoSkinState", size: 2, type: "vec2" }],
        fragment: "uniform vec2 tunnelVideoSkinState;",
      };
    }

    bindForSubMesh(buffer) {
      updateSourceFrame(currentSource, active);
      if (preparedSource) updateSourceFrame(preparedSource, active);
      if (requestedSwitch === preparedSource?.number && preparedSource.hasFrame) {
        promotePreparedSource();
      }
      buffer.updateFloat2(
        "tunnelVideoSkinState",
        active && currentSource.hasFrame ? VIDEO_OPACITY : 0,
        getIdyllSaturation(tunnelTime),
      );
      buffer.setTexture("tunnelVideoSampler", currentSource.texture);
    }

    getCustomCode(stage) {
      if (stage === "vertex") {
        return {
          CUSTOM_VERTEX_DEFINITIONS: "varying vec3 vTunnelVideoSkinCoord;",
          // Convert the authored longitudinal/circular UVs into one continuous
          // 0..1 film surface. The circular direction avoids interpolation
          // across the shell's closing UV seam.
          CUSTOM_VERTEX_MAIN_END: `vTunnelVideoSkinCoord = vec3(uv.x / 9.2,
            cos(uv.y / 2.8 * 6.2831853), sin(uv.y / 2.8 * 6.2831853));`,
        };
      }
      if (stage !== "fragment") return null;
      return {
        CUSTOM_FRAGMENT_DEFINITIONS: `varying vec3 vTunnelVideoSkinCoord;
          uniform sampler2D tunnelVideoSampler;`,
        CUSTOM_FRAGMENT_MAIN_END: `
          float tunnelVideoAlpha = tunnelVideoSkinState.x;
          if (tunnelVideoAlpha > 0.0001) {
            vec2 tunnelVideoUV = vec2(
              clamp(vTunnelVideoSkinCoord.x, 0.0, 1.0),
              fract(atan(vTunnelVideoSkinCoord.z, vTunnelVideoSkinCoord.y) / 6.2831853 + 1.0)
            );
            vec3 tunnelVideoSample = texture2D(tunnelVideoSampler, tunnelVideoUV).rgb;
            vec3 tunnelVideoLinear = toLinearSpace(tunnelVideoSample);
            float tunnelVideoLuma = dot(
              tunnelVideoLinear,
              vec3(0.2126, 0.7152, 0.0722)
            );
            tunnelVideoLinear = mix(
              vec3(tunnelVideoLuma),
              tunnelVideoLinear,
              tunnelVideoSkinState.y
            );
            #ifdef IMAGEPROCESSINGPOSTPROCESS
              vec3 tunnelVideoColor = tunnelVideoLinear;
            #else
              vec3 tunnelVideoColor = toGammaSpace(tunnelVideoLinear);
            #endif
            float tunnelVideoCombinedAlpha = tunnelVideoAlpha
              + gl_FragColor.a * (1.0 - tunnelVideoAlpha);
            gl_FragColor.rgb = (
              tunnelVideoColor * tunnelVideoAlpha
              + gl_FragColor.rgb * gl_FragColor.a * (1.0 - tunnelVideoAlpha)
            ) / max(tunnelVideoCombinedAlpha, 0.0001);
            gl_FragColor.a = tunnelVideoCombinedAlpha;
          }
        `,
      };
    }
  }

  new TunnelVideoSkinPlugin();

  const playSource = (source) => {
    source.video.autoplay = true;
    source.playing = true;
    const run = generation;
    source.video.play().catch((error) => {
      if (run !== generation || source.disposed) return;
      source.playing = false;
      if (active) {
        console.error(`TUNNEL VIDEO ${source.number} PLAY ERROR`, error);
      }
    });
  };

  const promotePreparedSource = () => {
    if (!preparedSource || requestedSwitch !== preparedSource.number) return;
    const previousSource = currentSource;
    currentSource = preparedSource;
    preparedSource = null;
    requestedSwitch = null;
    disposeSource(previousSource);
  };

  const prepare = (number) => {
    if (!active || currentSource.number === number || preparedSource?.number === number) return;
    if (preparedSource) disposeSource(preparedSource);
    preparedSource = createVideoSource(scene, number);
    playSource(preparedSource);
  };

  const reset = () => {
    generation += 1;
    active = false;
    requestedSwitch = null;
    tunnelTime = 0;
    if (preparedSource) {
      disposeSource(preparedSource);
      preparedSource = null;
    }
    if (currentSource.number === START_VIDEO) {
      resetSource(currentSource);
    } else {
      disposeSource(currentSource);
      currentSource = createVideoSource(scene, START_VIDEO);
    }
  };

  return {
    get opacity() { return VIDEO_OPACITY; },
    get currentVideo() { return currentSource.number; },
    get activeDecodeCount() {
      return Number(currentSource.playing) + Number(preparedSource?.playing ?? false);
    },
    update(time) {
      tunnelTime = time;
      if (active) return;
      active = true;
      generation += 1;
      playSource(currentSource);
    },
    prepare(number) {
      prepare(number);
    },
    switchTo(number) {
      if (!active || currentSource.number === number) return;
      if (preparedSource?.number !== number) prepare(number);
      requestedSwitch = number;
      if (preparedSource?.hasFrame) promotePreparedSource();
    },
    reset,
    dispose() {
      generation += 1;
      if (preparedSource) disposeSource(preparedSource);
      disposeSource(currentSource);
      preparedSource = null;
    },
  };
}

function createVideoSource(scene, number) {
  const video = document.createElement("video");
  video.autoplay = false;
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  const questOptimized = USE_QUEST_VIDEO_ASSETS && QUEST_VIDEO_NUMBERS.has(number);
  const assetPath = questOptimized
    ? `../../assets/videos/quest/${number}.mp4`
    : `../../assets/videos/${number}.mp4`;
  video.src = new URL(assetPath, import.meta.url).href;
  const texture = new BABYLON.VideoTexture(
    `tunnel-interior-video-${number}`,
    video,
    scene,
    false,
    true,
    BABYLON.Texture.BILINEAR_SAMPLINGMODE,
    { autoPlay: false, loop: true, muted: true, autoUpdateTexture: false },
  );
  texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  const source = { number, video, texture, hasFrame: false, playing: false,
    disposed: false, frameRevision: 0, uploadedRevision: -1, frameCallback: null };
  source.markFrame = () => { source.frameRevision += 1; };
  video.addEventListener("loadeddata", source.markFrame);
  video.addEventListener("seeked", source.markFrame);
  if (typeof video.requestVideoFrameCallback === "function") {
    const onFrame = () => {
      if (source.disposed) return;
      source.markFrame();
      source.frameCallback = video.requestVideoFrameCallback(onFrame);
    };
    source.frameCallback = video.requestVideoFrameCallback(onFrame);
  }
  return source;
}

function updateSourceFrame(source, shouldUpdate) {
  if (!shouldUpdate || source.video.readyState < 2 || !source.texture.isReady()) return;
  // Stereo eyes and high-refresh headsets can bind the same decoded frame
  // several times. Upload only new video frames where the browser exposes
  // them; retain the original per-render fallback on older implementations.
  const revision = source.frameCallback !== null
    ? source.frameRevision
    : source.video.getVideoPlaybackQuality?.().totalVideoFrames;
  if (source.hasFrame && revision !== undefined && revision === source.uploadedRevision) return;
  source.texture.updateTexture(true);
  source.uploadedRevision = revision;
  source.hasFrame = true;
}

function resetSource(source) {
  source.hasFrame = false;
  source.uploadedRevision = -1;
  source.markFrame();
  source.playing = false;
  source.video.autoplay = false;
  source.video.pause();
  if (source.video.currentTime !== 0) source.video.currentTime = 0;
}

function disposeSource(source) {
  source.disposed = true;
  if (source.frameCallback !== null) source.video.cancelVideoFrameCallback(source.frameCallback);
  source.video.removeEventListener("loadeddata", source.markFrame);
  source.video.removeEventListener("seeked", source.markFrame);
  source.playing = false;
  source.video.pause();
  source.texture.dispose();
  source.video.removeAttribute("src");
  source.video.load();
}
