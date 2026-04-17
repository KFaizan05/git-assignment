//Jenny Tran
// OCR pipeline — Tesseract.js v5 with adaptive preprocessing and quality gates.
//
// Pipeline:
//   1. Load the cropped image out of sessionStorage (set by CropPage).
//   2. Sanity-check the image — if it's essentially blank/uniform, bail out
//      before Tesseract hallucinates text on an empty picture.
//   3. Preprocess: grayscale + Otsu adaptive threshold. The fixed cutoff we
//      used before failed in low light and on dark labels.
//   4. Run Tesseract with an ingredient-friendly character whitelist.
//   5. Rebuild the output text from words that beat a confidence floor, so
//      random low-confidence guesses don't leak through.
//   6. Sanitize (strip non-whitelist chars, collapse whitespace) and verify
//      that the result at least looks like ingredient text.
//   7. Store the result in sessionStorage and move on to Results.

const croppedImage = sessionStorage.getItem("croppedImage");

const stepCapture = document.getElementById("stepCapture");
const stepRead = document.getElementById("stepRead");
const stepSafety = document.getElementById("stepSafety");

// In-app error popup elements. Defined on ParsingPage.html. We talk to them
// through showErrorModal() instead of calling alert() so the error is a clear,
// styled dialog inside the app instead of a browser chrome prompt.
const ocrErrorModal = document.getElementById("ocrErrorModal");
const ocrErrorIcon = document.getElementById("ocrErrorIcon");
const ocrErrorTitle = document.getElementById("ocrErrorTitle");
const ocrErrorBody = document.getElementById("ocrErrorBody");
const ocrErrorRetryBtn = document.getElementById("ocrErrorRetry");
const ocrErrorCancelBtn = document.getElementById("ocrErrorCancel");

// Show the in-app error popup. `options.onRetry` / `options.onCancel` run
// when the user taps Try Again / Cancel respectively. If not provided we
// fall back to sensible defaults (retry -> CropPage, cancel -> ScanPage).
function showErrorModal(options) {
  if (!ocrErrorModal) {
    // Extremely defensive — if the modal markup isn't on the page for some
    // reason, we still need to surface the problem instead of silently
    // stalling the user.
    alert(options.body || "Something went wrong.");
    return;
  }

  const {
    icon = "⚠",
    title = "Unreadable scan",
    body = "We couldn't read any ingredients from that image.",
    retryText = "Try Again",
    cancelText = "Cancel",
    onRetry,
    onCancel
  } = options || {};

  ocrErrorIcon.textContent = icon;
  ocrErrorTitle.textContent = title;
  ocrErrorBody.textContent = body;
  ocrErrorRetryBtn.textContent = retryText;
  ocrErrorCancelBtn.textContent = cancelText;

  // Replace click handlers each time so we don't stack them.
  const retryHandler = () => {
    hideErrorModal();
    if (typeof onRetry === "function") onRetry();
    else window.location.href = "CropPage.html";
  };
  const cancelHandler = () => {
    hideErrorModal();
    if (typeof onCancel === "function") onCancel();
    else window.location.href = "ScanPage.html";
  };

  ocrErrorRetryBtn.onclick = retryHandler;
  ocrErrorCancelBtn.onclick = cancelHandler;

  ocrErrorModal.hidden = false;
  // Defer focus until the modal is actually visible.
  setTimeout(() => ocrErrorRetryBtn.focus(), 0);
}

function hideErrorModal() {
  if (ocrErrorModal) ocrErrorModal.hidden = true;
}

// Guard flag so we don't kick off Tesseract if there's no image to process.
let hasCroppedImage = !!croppedImage;

// Characters we expect on an ingredients label. Anything else is almost
// certainly hallucinated garbage and gets stripped. We keep this generous
// because label text commonly includes "%", "&", parentheses, asterisks,
// and em-dashes; being too strict can delete real content.
const OCR_CHAR_WHITELIST =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,.;:()[]%*-/&'\"!?\n";

const MIN_WORD_CONFIDENCE = 40;    // drop Tesseract words below this confidence
const BLANK_STDDEV_THRESHOLD = 8;  // images below this pixel stddev are treated as blank
const MIN_OCR_WIDTH = 1200;        // upscale anything narrower — Tesseract needs ~300 DPI equivalent

// -----------------------------------------------------------------------------
// Step-indicator UI
// -----------------------------------------------------------------------------
// Case-insensitive so callers can pass "Completed"/"completed"/"COMPLETED".
function setStepState(stepEl, state, text) {
  if (!stepEl) return;
  const normalized = String(state || "").toLowerCase();

  stepEl.classList.remove("completed", "active", "pending");

  let iconHtml = '<div class="step-icon dot"></div>';
  if (normalized === "completed") {
    stepEl.classList.add("completed");
    iconHtml = '<div class="step-icon check">✓</div>';
  } else if (normalized === "active") {
    stepEl.classList.add("active");
    iconHtml = '<div class="step-icon spinner"></div>';
  } else {
    stepEl.classList.add("pending");
  }

  stepEl.innerHTML = `${iconHtml}<div class="step-text">${text}</div>`;
}

// -----------------------------------------------------------------------------
// Image analysis / preprocessing
// -----------------------------------------------------------------------------

// Decode a dataUrl into a canvas we can read pixels from. If the image is
// smaller than MIN_OCR_WIDTH we upscale with smoothing — small crops are
// the #1 cause of clipped/missing characters in Tesseract.
function loadToCanvas(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;

      let scale = 1;
      if (srcW < MIN_OCR_WIDTH) {
        scale = MIN_OCR_WIDTH / srcW;
      }
      const outW = Math.round(srcW * scale);
      const outH = Math.round(srcH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, outW, outH);
      resolve({ canvas, ctx });
    };
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = dataUrl;
  });
}

// 8-bit luma histogram. Used by both Otsu and the blank-image check.
function grayscaleHistogram(imageData) {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    histogram[gray]++;
    total++;
  }
  return { histogram, total };
}

// Population stddev straight from the histogram — cheaper than a second pass.
// A very low value means the image is nearly one color, which is our signal
// to refuse OCR instead of letting Tesseract invent words.
function stddevFromHistogram(histogram, total) {
  if (total === 0) return 0;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  const mean = sum / total;

  let sqsum = 0;
  for (let i = 0; i < 256; i++) {
    const diff = i - mean;
    sqsum += diff * diff * histogram[i];
  }
  return Math.sqrt(sqsum / total);
}

// Otsu's method — picks the grayscale threshold that maximizes between-class
// variance. Adapts to lighting instead of using a hard-coded 150 cutoff.
function otsuThreshold(histogram, total) {
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);

    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

// Soft preprocess: convert to grayscale with a contrast stretch centered on
// the Otsu threshold. This preserves partial ink (thin strokes, lightly
// printed characters) that full binarization would erase, while still
// making the text pop for Tesseract.
function grayscaleStretchInPlace(imageData, threshold) {
  const data = imageData.data;
  // Pivot contrast around the threshold so darker-than-threshold pixels get
  // pushed toward black and lighter-than-threshold pixels toward white.
  const lowEnd = Math.max(0, threshold - 40);
  const highEnd = Math.min(255, threshold + 40);
  const range = Math.max(1, highEnd - lowEnd);

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let out;
    if (gray <= lowEnd) out = 0;
    else if (gray >= highEnd) out = 255;
    else out = Math.round(((gray - lowEnd) / range) * 255);
    data[i] = out;
    data[i + 1] = out;
    data[i + 2] = out;
  }
}

// Full preprocessing pass. Returns a cleaned-up dataUrl plus quality signals.
async function preprocessImage(dataUrl) {
  const { canvas, ctx } = await loadToCanvas(dataUrl);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const { histogram, total } = grayscaleHistogram(imageData);
  const stddev = stddevFromHistogram(histogram, total);
  const threshold = otsuThreshold(histogram, total);

  // Use a soft contrast stretch instead of hard binarization — hard
  // binarization was erasing light ink and clipping characters.
  grayscaleStretchInPlace(imageData, threshold);
  ctx.putImageData(imageData, 0, 0);

  return {
    processedDataUrl: canvas.toDataURL("image/png"),
    stddev,
    threshold
  };
}

// -----------------------------------------------------------------------------
// Text post-processing
// -----------------------------------------------------------------------------

// Rebuild the output from words that beat the confidence floor. Falls back to
// result.data.text if word-level info isn't available.
function textFromConfidentWords(result) {
  const words = result?.data?.words;
  if (!Array.isArray(words) || words.length === 0) {
    return (result?.data?.text || "").trim();
  }
  const kept = words
    .filter((w) => typeof w.text === "string" && w.text.trim().length > 0)
    .filter((w) => (w.confidence ?? 0) >= MIN_WORD_CONFIDENCE)
    .map((w) => w.text.trim());
  return kept.join(" ");
}

// Drop non-whitelist chars, collapse whitespace, trim.
function sanitizeText(text) {
  if (!text) return "";
  const allowed = /[A-Za-z0-9 ,.;:()\[\]%*\-/&'"!?\n]/g;
  const keptChars = (text.match(allowed) || []).join("");
  return keptChars.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// Heuristic sanity check — does this actually look like a readable label?
function looksLikeIngredients(text) {
  if (!text) return false;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (letters < 10) return false;
  const words = text.split(/\s+/).filter((w) => w.length >= 3);
  return words.length >= 3;
}

// -----------------------------------------------------------------------------
// Main OCR flow
// -----------------------------------------------------------------------------
async function runOCRFlow() {
  let worker;
  try {
    setStepState(stepCapture, "completed", "Image captured");
    setStepState(stepRead, "active", "Reading ingredients...");
    setStepState(stepSafety, "pending", "Analyzing safety");

    const { processedDataUrl, stddev } = await preprocessImage(croppedImage);

    // Blank / uniform image — bail before Tesseract hallucinates a label.
    if (stddev < BLANK_STDDEV_THRESHOLD) {
      setStepState(stepRead, "pending", "No text found");
      setStepState(stepSafety, "pending", "Analyzing safety");
      sessionStorage.setItem("ocrText", "");
      showErrorModal({
        icon: "📷",
        title: "Image looks blank",
        body: "We couldn't see a label in that image. Please retake the photo with the ingredients clearly visible.",
        retryText: "Try Again",
        cancelText: "Cancel",
        onRetry: () => { window.location.href = "CropPage.html"; },
        onCancel: () => { window.location.href = "ScanPage.html"; }
      });
      return;
    }

    worker = await Tesseract.createWorker("eng", 1);
    // Bias Tesseract toward a single uniform block of label text. We don't
    // use a character whitelist here because it made recognition worse
    // (Tesseract tries harder to map glyphs into the whitelist and ends up
    // misreading real characters). Instead we sanitize the output text
    // afterward — that way we don't affect character recognition itself.
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
      user_defined_dpi: "300"
    });

    const result = await worker.recognize(processedDataUrl);

    const rawFromWords = textFromConfidentWords(result);
    const sanitized = sanitizeText(rawFromWords);

    if (!looksLikeIngredients(sanitized)) {
      setStepState(stepRead, "pending", "No readable text");
      setStepState(stepSafety, "pending", "Analyzing safety");
      sessionStorage.setItem("ocrText", "");
      showErrorModal({
        icon: "🔍",
        title: "Unreadable scan",
        body: "We couldn't read any ingredients from that image. Try again with better lighting, a steadier hand, or a closer crop around the ingredients list.",
        retryText: "Try Again",
        cancelText: "Cancel",
        onRetry: () => { window.location.href = "CropPage.html"; },
        onCancel: () => { window.location.href = "ScanPage.html"; }
      });
      return;
    }

    sessionStorage.setItem("ocrText", sanitized);

    setStepState(stepRead, "completed", "Ingredients extracted");
    setStepState(stepSafety, "active", "Analyzing safety");

    //short delay so user sees the state change
    await new Promise((resolve) => setTimeout(resolve, 900));

    setStepState(stepSafety, "completed", "Safety analysis complete");

    window.location.href = "ResultsPage.html";
  } catch (error) {
    console.error(error);
    setStepState(stepRead, "pending", "OCR failed");
    setStepState(stepSafety, "pending", "Analyzing safety");
    showErrorModal({
      icon: "⚠",
      title: "Something went wrong",
      body: "We hit an error while reading the label. Please try again.",
      retryText: "Try Again",
      cancelText: "Cancel",
      onRetry: () => { window.location.href = "CropPage.html"; },
      onCancel: () => { window.location.href = "ScanPage.html"; }
    });
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) { /* ignore */ }
    }
  }
}

if (hasCroppedImage) {
  runOCRFlow();
} else {
  // No image at all — show the popup instead of silently spinning.
  setStepState(stepCapture, "pending", "No image");
  setStepState(stepRead, "pending", "Reading ingredients");
  setStepState(stepSafety, "pending", "Analyzing safety");
  showErrorModal({
    icon: "📷",
    title: "No image to scan",
    body: "We couldn't find a cropped image. Please take a photo and try again.",
    retryText: "Scan a Product",
    cancelText: "Cancel",
    onRetry: () => { window.location.href = "ScanPage.html"; },
    onCancel: () => { window.location.href = "DashboardPage.html"; }
  });
}
