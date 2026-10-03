import { PERF_DEBUG } from "./performanceDebug.js";

const HUD_UPDATE_INTERVAL_MS = 500;
const FRAME_SAMPLE_CAPACITY = 256;

function countActiveAudioLayers(scene, transitionState) {
  let count = transitionState.inTunnel ? 1 : 0;
  const metadata = scene.metadata ?? {};

  if (metadata.voicesSound?.getDebugState?.().playing) count += 1;
  if (metadata.trafficSound?.getDebugState?.().playing) count += 1;

  const sensoryStates = metadata.sensoryOverloadSound?.getDebugState?.() ?? {};
  for (const state of Object.values(sensoryStates)) {
    if (state?.playing) count += 1;
  }

  return count;
}

function createDomHud() {
  const element = document.createElement("pre");
  element.id = "perf-debug-hud";
  element.setAttribute("aria-live", "off");
  Object.assign(element.style, {
    position: "fixed",
    left: "10px",
    top: "10px",
    zIndex: "100000",
    margin: "0",
    padding: "8px 10px",
    maxWidth: "min(360px, calc(100vw - 20px))",
    color: "#9fffb8",
    background: "rgba(0, 0, 0, 0.78)",
    border: "1px solid rgba(159, 255, 184, 0.55)",
    borderRadius: "4px",
    font: "12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    pointerEvents: "none",
    whiteSpace: "pre-wrap",
  });
  document.body.appendChild(element);
  return element;
}

function createXrHud(scene) {
  const texture = new BABYLON.DynamicTexture(
    "perf-debug-xr-texture",
    { width: 768, height: 448 },
    scene,
    false,
  );
  texture.hasAlpha = true;

  const material = new BABYLON.StandardMaterial("perf-debug-xr-material", scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.emissiveColor = BABYLON.Color3.White();
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.depthFunction = BABYLON.Constants.ALWAYS;

  const plane = BABYLON.MeshBuilder.CreatePlane(
    "perf-debug-xr-plane",
    { width: 1.08, height: 0.63 },
    scene,
  );
  plane.material = material;
  plane.isPickable = false;
  plane.alwaysSelectAsActiveMesh = true;
  plane.renderingGroupId = 3;
  plane.setEnabled(false);

  const draw = (lines) => {
    if (!plane.isEnabled()) return;
    const context = texture.getContext();
    context.clearRect(0, 0, 768, 448);
    context.fillStyle = "rgba(0, 0, 0, 0.82)";
    context.fillRect(0, 0, 768, 448);
    context.strokeStyle = "rgba(159, 255, 184, 0.8)";
    context.lineWidth = 3;
    context.strokeRect(2, 2, 764, 444);
    context.fillStyle = "#9fffb8";
    context.font = "30px monospace";
    lines.forEach((line, index) => context.fillText(line, 22, 42 + index * 42));
    texture.update(false);
  };

  return { plane, material, texture, draw };
}

export function createPerformanceHud(scene) {
  if (!PERF_DEBUG.enabled) return null;

  const engine = scene.getEngine();
  const domHud = createDomHud();
  const xrHud = createXrHud(scene);
  const frameTimes = new Float32Array(FRAME_SAMPLE_CAPACITY);
  const sampleTimes = new Float64Array(FRAME_SAMPLE_CAPACITY);
  let sampleIndex = 0;
  let sampleCount = 0;
  let nextHudUpdate = 0;
  let xrStateObserver = null;
  let xrHelper = null;

  const renderObserver = scene.onAfterRenderObservable.add(() => {
    const now = performance.now();
    const frameTime = engine.getDeltaTime();
    frameTimes[sampleIndex] = frameTime;
    sampleTimes[sampleIndex] = now;
    sampleIndex = (sampleIndex + 1) % FRAME_SAMPLE_CAPACITY;
    sampleCount = Math.min(sampleCount + 1, FRAME_SAMPLE_CAPACITY);

    if (now < nextHudUpdate) return;
    nextHudUpdate = now + HUD_UPDATE_INTERVAL_MS;

    let maxFrameTime = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      if (now - sampleTimes[index] <= 2000) {
        maxFrameTime = Math.max(maxFrameTime, frameTimes[index]);
      }
    }

    const transitionState = scene.metadata?.transition?.getPerformanceState?.() ?? {
      tunnelProgress: 0,
      inTunnel: false,
    };
    const videoState = scene.metadata?.tunnel?.getVideoState?.() ?? {};
    const activeMeshes = scene.getActiveMeshes?.().length;
    const lines = [
      `PERFDEBUG ${PERF_DEBUG.mode}`,
      `FPS ${engine.getFps().toFixed(1)} | FRAME ${frameTime.toFixed(1)} ms`,
      `MAX FRAME 2s ${maxFrameTime.toFixed(1)} ms`,
      `TUNNEL ${(transitionState.tunnelProgress * 100).toFixed(1)}%`,
      `VIDEO DECODERS ${videoState.activeDecoders ?? 0}`,
      `AUDIO LAYERS ${countActiveAudioLayers(scene, transitionState)}`,
      `ACTIVE MESHES ${Number.isFinite(activeMeshes) ? activeMeshes : "n/a"}`,
    ];
    const text = lines.join("\n");
    domHud.textContent = text;
    xrHud.draw(lines);
  });

  return {
    attachWebXR(xr) {
      if (!xr?.onStateChangedObservable) return;
      xrHelper = xr;
      xrStateObserver = xr.onStateChangedObservable.add((state) => {
        const inXr = state === BABYLON.WebXRState.IN_XR;
        xrHud.plane.setEnabled(inXr);
        if (inXr) {
          xrHud.plane.parent = xr.camera;
          xrHud.plane.position.set(0, -0.34, 1.4);
          xrHud.plane.rotation.set(0, 0, 0);
        } else {
          xrHud.plane.parent = null;
        }
      });
    },
    dispose() {
      scene.onAfterRenderObservable.remove(renderObserver);
      if (xrStateObserver && xrHelper) {
        xrHelper.onStateChangedObservable.remove(xrStateObserver);
      }
      domHud.remove();
      xrHud.plane.dispose();
      xrHud.material.dispose();
      xrHud.texture.dispose();
    },
  };
}
