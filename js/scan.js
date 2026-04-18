//Jenny Tran
const video = document.getElementById("video");
const captureCanvas = document.getElementById("captureCanvas");
const scanBtn = document.getElementById("scanBtn");
const scanFrame = document.getElementById("scanFrame");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const flipBtn = document.getElementById("flipBtn");

// Paste-text modal elements — let the user drop in ingredient text directly
// (e.g. copied from a website or email) and send it straight through the
// analysis pipeline without running OCR.
const pasteBtn = document.getElementById("pasteBtn");
const pasteModal = document.getElementById("pasteModal");
const pasteModalBackdrop = document.getElementById("pasteModalBackdrop");
const pasteTextInput = document.getElementById("pasteTextInput");
const pasteCancelBtn = document.getElementById("pasteCancelBtn");
const pasteAnalyzeBtn = document.getElementById("pasteAnalyzeBtn");
const pasteModalError = document.getElementById("pasteModalError");

// Camera-permission modal: shown from the capture-button handler if the
// camera feed isn't live (typically because permission was denied). We
// can't programmatically re-trigger the native prompt after a deny, but
// the Try Again button re-calls getUserMedia so the user can recover after
// flipping the site setting to Allow.
const cameraPermModal = document.getElementById("cameraPermModal");
const cameraPermBackdrop = document.getElementById("cameraPermBackdrop");
const cameraPermCancel = document.getElementById("cameraPermCancel");
const cameraPermRetry = document.getElementById("cameraPermRetry");

let stream = null;
// Track which camera we're currently using so the flip button can toggle
// between front ("user") and back ("environment"). Starts on the back
// camera since that's what you'd point at a product label.
let currentFacingMode = "environment";
// Guard against double-taps on the flip button while getUserMedia is still
// resolving — the second call would race and leave the stream in a weird
// state.
let flipInFlight = false;

//This will prompt the user for camera permissions
//If granted permission, the application will start the live camera feed
//only needs to be given permission one time.
// Accepts a facingMode ("environment" for back / "user" for front). If the
// device doesn't have a camera matching the requested direction, the video
// element is left blank (black) — the user can tap flip again to swap.
async function startCamera(facingMode = currentFacingMode) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.log("Camera API not supported");
    return;
  }

  // Stop the previous stream before requesting a new one. Some browsers
  // (notably iOS Safari) won't hand out a second video track while the
  // first is still live, so skipping this makes flipCamera() a no-op.
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    //Displays the live camera feed on screen
    video.srcObject = stream;
    await video.play();
    currentFacingMode = facingMode;
    console.log(`Camera ready (${facingMode})`);
  } catch (error) {
    // Leaves the <video> showing black, which is the agreed behavior when
    // the requested direction isn't available on this device.
    console.error(`Could not access ${facingMode} camera:`, error);
  }
}

// Toggle between front and back cameras.
async function flipCamera() {
  if (flipInFlight) return;
  flipInFlight = true;
  try {
    const next = currentFacingMode === "environment" ? "user" : "environment";
    await startCamera(next);
  } finally {
    flipInFlight = false;
  }
}

if (flipBtn) {
  flipBtn.addEventListener("click", flipCamera);
}

backBtn.addEventListener("click", () => {
  window.location.href = "DashboardPage.html";
});

//Captures image inside the scan frame after clicking button
function captureOnlyFrameAndGoNext() {
  if (!video.videoWidth || !video.videoHeight) {
    console.log("Video not ready yet");
    return;
  }

  //Cropping logic to scale
  const videoRect = video.getBoundingClientRect();
  const frameRect = scanFrame.getBoundingClientRect();

  const sourceW = video.videoWidth;
  const sourceH = video.videoHeight;
  const destW = videoRect.width;
  const destH = videoRect.height;

  const scale = Math.max(destW / sourceW, destH / sourceH);

  const renderedW = sourceW * scale;
  const renderedH = sourceH * scale;

  const offsetX = (renderedW - destW) / 2;
  const offsetY = (renderedH - destH) / 2;

  const frameXInVideo = frameRect.left - videoRect.left;
  const frameYInVideo = frameRect.top - videoRect.top;

  const cropX = (frameXInVideo + offsetX) / scale;
  const cropY = (frameYInVideo + offsetY) / scale;
  const cropWidth = frameRect.width / scale;
  const cropHeight = frameRect.height / scale;

  captureCanvas.width = Math.round(cropWidth);
  captureCanvas.height = Math.round(cropHeight);

  const ctx = captureCanvas.getContext("2d");

  ctx.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height
  );

  //Saves image temporarily for cropping
  const croppedFrameImage = captureCanvas.toDataURL("image/jpeg", 0.95);
  sessionStorage.setItem("capturedImage", croppedFrameImage);

  window.location.href = "CropPage.html";
}

function handleUploadedImage(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (event) {
    const imageDataUrl = event.target.result;
    sessionStorage.setItem("capturedImage", imageDataUrl);
    window.location.href = "CropPage.html";
  };

  reader.readAsDataURL(file);
}

// ---- Camera permission recovery --------------------------------------------
// Browsers intentionally won't re-trigger the native permission prompt once
// a user has clicked Block — any subsequent getUserMedia() call will just
// reject silently. To give the user a path forward when they tap the
// capture button after a deny (or on a page load where the camera never
// came up), we check the Permissions API, try one more getUserMedia(), and
// surface a modal with clear instructions if it still fails.

function showCameraPermModal() {
  if (!cameraPermModal) return;
  cameraPermModal.hidden = false;
}

function hideCameraPermModal() {
  if (!cameraPermModal) return;
  cameraPermModal.hidden = true;
}

// navigator.permissions isn't universally supported (Safari had partial
// support until recently), and some browsers throw on unknown permission
// names. Wrap it defensively and default to "prompt" (i.e. assume the user
// hasn't decided yet, so we can safely try getUserMedia to show the prompt).
async function getCameraPermissionState() {
  if (!navigator.permissions || !navigator.permissions.query) return "prompt";
  try {
    const status = await navigator.permissions.query({ name: "camera" });
    return status.state; // "granted" | "denied" | "prompt"
  } catch (_) {
    return "prompt";
  }
}

function cameraIsLive() {
  return !!stream && !!video.videoWidth && !!video.videoHeight;
}

async function handleScanClick() {
  // Happy path — video feed is running, take the shot.
  if (cameraIsLive()) {
    captureOnlyFrameAndGoNext();
    return;
  }

  // If permissions are outright denied, getUserMedia will reject
  // immediately with no prompt — go straight to the instructions modal so
  // the user knows they need to fix it in browser settings.
  const state = await getCameraPermissionState();
  if (state === "denied") {
    showCameraPermModal();
    return;
  }

  // State is either "prompt" (first visit, user hasn't decided) or
  // "granted" (permission was OK but camera wasn't running for some other
  // reason, e.g. device busy). Retry getUserMedia — this shows the native
  // prompt on first-visit, or picks up a freshly-granted permission.
  await startCamera();

  if (cameraIsLive()) {
    // Camera came online — capture immediately so the user's tap isn't
    // wasted.
    captureOnlyFrameAndGoNext();
  } else {
    // Still not working. Most often means the user just hit Block on the
    // prompt that appeared. Show the instructions modal.
    showCameraPermModal();
  }
}

scanBtn.addEventListener("click", handleScanClick);

if (cameraPermCancel) {
  cameraPermCancel.addEventListener("click", hideCameraPermModal);
}
if (cameraPermBackdrop) {
  cameraPermBackdrop.addEventListener("click", hideCameraPermModal);
}
if (cameraPermRetry) {
  cameraPermRetry.addEventListener("click", async () => {
    hideCameraPermModal();
    // Retry — works if the user just went into site settings and flipped
    // Camera to Allow. If it still fails, surface the modal again so the
    // instructions stay visible.
    await startCamera();
    if (cameraIsLive()) {
      captureOnlyFrameAndGoNext();
    } else {
      showCameraPermModal();
    }
  });
}

uploadBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  handleUploadedImage(file);
  fileInput.value = "";
});

// ---- Paste-text flow --------------------------------------------------------
// User can paste an ingredient list directly rather than scanning. We bypass
// the OCR / Parsing pages entirely, drop the text into the same sessionStorage
// slot the OCR pipeline writes to, and jump to ResultsPage where results.js
// cross-checks it against the user's dietary profile + allergens (including
// their custom allergens).

function showPasteError(message) {
  if (!pasteModalError) return;
  pasteModalError.textContent = message;
  pasteModalError.hidden = false;
}

function clearPasteError() {
  if (!pasteModalError) return;
  pasteModalError.textContent = "";
  pasteModalError.hidden = true;
}

function openPasteModal() {
  if (!pasteModal) return;
  clearPasteError();
  pasteModal.hidden = false;
  // Defer focus so the modal is fully visible before we focus the textarea.
  setTimeout(() => {
    if (pasteTextInput) pasteTextInput.focus();
  }, 0);
}

function closePasteModal() {
  if (!pasteModal) return;
  pasteModal.hidden = true;
}

// Quick sanity check — we don't want someone mashing "asdf" and getting a
// scan result. Require at least ~3 real words, same bar OCR uses.
function looksLikeIngredientText(text) {
  if (!text) return false;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (letters < 10) return false;
  const words = text.split(/\s+/).filter((w) => w.length >= 3);
  return words.length >= 3;
}

function submitPastedText() {
  const raw = pasteTextInput ? pasteTextInput.value : "";
  const trimmed = String(raw || "").trim();

  if (!trimmed) {
    showPasteError("Please paste some ingredient text first.");
    return;
  }

  if (!looksLikeIngredientText(trimmed)) {
    showPasteError("That doesn't look like an ingredient list. Paste the full text from the label and try again.");
    return;
  }

  // Clear any leftover image so ResultsPage doesn't re-render an old scan's
  // raw OCR preview for this run. Results.js pulls from ocrText only.
  try {
    sessionStorage.removeItem("croppedImage");
    sessionStorage.removeItem("capturedImage");
  } catch (_) { /* ignore */ }

  sessionStorage.setItem("ocrText", trimmed);
  try { sessionStorage.setItem("ocrEngine", "manual"); } catch (_) { /* ignore */ }

  closePasteModal();
  window.location.href = "ResultsPage.html";
}

if (pasteBtn) {
  pasteBtn.addEventListener("click", openPasteModal);
}
if (pasteCancelBtn) {
  pasteCancelBtn.addEventListener("click", closePasteModal);
}
if (pasteModalBackdrop) {
  pasteModalBackdrop.addEventListener("click", closePasteModal);
}
if (pasteAnalyzeBtn) {
  pasteAnalyzeBtn.addEventListener("click", submitPastedText);
}
if (pasteTextInput) {
  pasteTextInput.addEventListener("input", () => {
    if (pasteModalError && !pasteModalError.hidden) clearPasteError();
  });
  // Ctrl/Cmd+Enter submits — convenient after a long paste.
  pasteTextInput.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitPastedText();
    }
  });
}
// Esc closes whichever modal is open.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (pasteModal && !pasteModal.hidden) closePasteModal();
  if (cameraPermModal && !cameraPermModal.hidden) hideCameraPermModal();
});

window.addEventListener("beforeunload", () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
});

startCamera();