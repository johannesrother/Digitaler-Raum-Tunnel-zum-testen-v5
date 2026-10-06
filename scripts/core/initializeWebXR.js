import { setStatus } from "../utils/dom.js";

const IMMERSIVE_VR = "immersive-vr";
const LOCAL_FLOOR = "local-floor";
const LOCAL = "local";
const XR_FRAMEBUFFER_SCALE = 0.9;

/**
 * Adds an optional WebXR entry path without affecting desktop rendering.
 */
export async function initializeWebXR({ scene, enterVrButton, statusElement, onEntered }) {
  if (!navigator.xr) {
    showVrUnavailable(enterVrButton);
    setStatus(statusElement, "WebXR ist in diesem Browser nicht verfügbar. Desktop-Test aktiv.");
    return null;
  }

  try {
    const immersiveVrSupported = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync(
      IMMERSIVE_VR,
    );

    if (!immersiveVrSupported) {
      showVrUnavailable(enterVrButton);
      setStatus(statusElement, "Immersives VR wird hier nicht unterstützt. Desktop-Test aktiv.");
      return null;
    }

    // The base helper supplies the XR camera and session lifecycle only.
    // Locomotion, interactions and artistic XR behaviour are intentionally deferred.
    const xr = await BABYLON.WebXRExperienceHelper.CreateAsync(scene);

    // local-floor lets a headset use its tracked standing height above y = 0.
    xr.onInitialXRPoseSetObservable.add((xrCamera) => {
      xrCamera.position.y = 0;
    });

    const grassAliasingAB = createQuestGrassAliasingAB(scene);
    enableVrEntry({ xr, enterVrButton, statusElement, onEntered, grassAliasingAB });
    setStatus(statusElement, "WebXR bereit. VR kann betreten werden.");
    return xr;
  } catch (error) {
    showVrUnavailable(enterVrButton);
    console.warn("WebXR konnte nicht initialisiert werden; der Desktop-Test bleibt verfügbar.", error);
    setStatus(statusElement, "WebXR konnte nicht vorbereitet werden. Desktop-Test aktiv.");
    return null;
  }
}

function enableVrEntry({ xr, enterVrButton, statusElement, onEntered, grassAliasingAB }) {
  delete enterVrButton.dataset.xrUnavailable;
  enterVrButton.hidden = false;
  enterVrButton.disabled = false;
  enterVrButton.textContent = "VR betreten";

  xr.onStateChangedObservable.add((state) => {
    const inVr = state === BABYLON.WebXRState.IN_XR;
    enterVrButton.hidden = inVr;

    if (inVr) {
      grassAliasingAB.hide();
      setStatus(statusElement, "VR ist aktiv.");
    } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
      grassAliasingAB.restore();
      if (!enterVrButton.disabled) {
        enterVrButton.textContent = "VR betreten";
        setStatus(statusElement, "WebXR bereit. VR kann betreten werden.");
      }
    } else if (!enterVrButton.disabled) {
      enterVrButton.textContent = "VR betreten";
      setStatus(statusElement, "WebXR bereit. VR kann betreten werden.");
    }
  });

  enterVrButton.addEventListener("click", async () => {
    enterVrButton.disabled = true;
    enterVrButton.textContent = "VR wird gestartet…";
    setStatus(statusElement, "VR-Session wird gestartet …");

    try {
      grassAliasingAB.hide();
      await enterImmersiveVr(xr);
      onEntered?.();
    } catch (error) {
      grassAliasingAB.restore();
      enterVrButton.textContent = "VR erneut versuchen";
      console.error("Die immersive VR-Session konnte nicht gestartet werden.", error);
      setStatus(statusElement, "VR-Session konnte nicht gestartet werden. Desktop-Test aktiv.");
    } finally {
      enterVrButton.disabled = false;
    }
  });
}

function createQuestGrassAliasingAB(scene) {
  const grassMeshes = scene.meshes.filter((mesh) => mesh.metadata?.questGrassAliasingAB);
  const desktopVisibility = new Map(grassMeshes.map((mesh) => [mesh, mesh.isVisible]));
  return {
    hide() {
      grassMeshes.forEach((mesh) => { mesh.isVisible = false; });
    },
    restore() {
      grassMeshes.forEach((mesh) => { mesh.isVisible = desktopVisibility.get(mesh); });
    },
  };
}

function showVrUnavailable(enterVrButton) {
  enterVrButton.dataset.xrUnavailable = "true";
  enterVrButton.hidden = false;
  enterVrButton.disabled = true;
  enterVrButton.textContent = "VR nicht verfügbar";
}

async function enterImmersiveVr(xr) {
  const engine = xr.sessionManager.scene.getEngine();
  const renderTarget = xr.sessionManager.getWebXRRenderTarget({
    canvasElement: engine.getRenderingCanvas(),
    canvasOptions: {
      antialias: true,
      depth: true,
      stencil: engine.isStencilEnable,
      alpha: true,
      framebufferScaleFactor: XR_FRAMEBUFFER_SCALE,
    },
  });
  try {
    await xr.enterXRAsync(IMMERSIVE_VR, LOCAL_FLOOR, renderTarget);
  } catch (localFloorError) {
    // A few WebXR implementations lack local-floor; keep a safe VR fallback.
    console.info("local-floor ist nicht verfügbar; WebXR startet mit lokalem Referenzraum.", localFloorError);
    await xr.enterXRAsync(IMMERSIVE_VR, LOCAL, renderTarget);
  }
}
