//Jenny Tran
// OCR pipeline — OCR.space (cloud) primary + Tesseract.js v5 fallback.
//
// Pipeline:
//   1. Load the cropped image out of sessionStorage (set by CropPage).
//   2. Sanity-check the image — if it's essentially blank/uniform, bail out
//      before any engine hallucinates text on an empty picture.
//   3. Preprocess: grayscale + Otsu-guided contrast stretch. Soft stretch
//      preserves thin strokes that hard binarization would erase.
//   4. Try OCR.space first (Engine 2). It handles real-world label fonts,
//      curved packaging, and varied lighting far better than local Tesseract.
//   5. If OCR.space is unavailable (network error, rate limit, poor result)
//      fall back to Tesseract so the app still works offline.
//   6. Sanitize the text and verify it at least looks like ingredient text.
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

const MIN_WORD_CONFIDENCE = 35;    // keep borderline words on dense condensed labels
const BLANK_STDDEV_THRESHOLD = 8;  // images below this pixel stddev are treated as blank
const MIN_OCR_WIDTH = 1800;        // minimum upscale for preprocess + Tesseract (dense labels)
const MIN_CLOUD_OCR_WIDTH = 2200;  // cloud OCR: more pixels helps small print
const MAX_OCR_DIMENSION = 5000;    // cap canvas size / API payload

// -----------------------------------------------------------------------------
// OCR.space (cloud) configuration
// -----------------------------------------------------------------------------
// `helloworld` is OCR.space's public test key (rate-limited, fine for demo).
// Users can drop in their own free API key from https://ocr.space/ocrapi via:
//   localStorage.setItem("labelwiseOcrSpaceKey", "<key>");
const OCR_SPACE_API_KEY = (() => {
  try {
    return localStorage.getItem("labelwiseOcrSpaceKey") || "helloworld";
  } catch (_) {
    return "helloworld";
  }
})();
const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";
const OCR_SPACE_MAX_BYTES = 1024 * 1024; // 1 MB free-tier upload limit
const OCR_SPACE_TIMEOUT_MS = 20000;

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

// Decode a dataUrl into a canvas. Upscales narrow images; caps longest side.
function loadToCanvas(dataUrl, minWidth = MIN_OCR_WIDTH) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      if (!srcW || !srcH) {
        reject(new Error("Invalid image dimensions."));
        return;
      }

      let scale = 1;
      if (srcW < minWidth) {
        scale = minWidth / srcW;
      }
      let outW = Math.round(srcW * scale);
      let outH = Math.round(srcH * scale);

      const maxDim = Math.max(outW, outH);
      if (maxDim > MAX_OCR_DIMENSION) {
        const cap = MAX_OCR_DIMENSION / maxDim;
        outW = Math.round(outW * cap);
        outH = Math.round(outH * cap);
      }

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

// High-res color JPEG for OCR.space — keeps color; avoids harsh binarization.
async function prepareNaturalImageForCloudOcr(dataUrl) {
  const { canvas, ctx } = await loadToCanvas(dataUrl, MIN_CLOUD_OCR_WIDTH);
  try {
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tctx = temp.getContext("2d");
    tctx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.filter = "contrast(1.12) brightness(1.03)";
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
  } catch (_) {
    /* keep plain upscale */
  }
  return canvas.toDataURL("image/jpeg", 0.93);
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
  const { canvas, ctx } = await loadToCanvas(dataUrl, MIN_OCR_WIDTH);
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
// OCR.space client
// -----------------------------------------------------------------------------

// Approximate decoded byte size of a dataUrl payload.
function dataUrlBytes(dataUrl) {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return dataUrl.length;
  // Base64 expands 3 bytes -> 4 chars, minus padding.
  return Math.ceil(((dataUrl.length - commaIdx - 1) * 3) / 4);
}

// Make sure the image fits inside OCR.space's free-tier 1 MB upload limit.
// If the preprocessed PNG is too big we re-encode as progressively-lower-quality
// JPEG until it fits. OCR.space handles both formats fine.
async function fitOcrSpacePayload(dataUrl) {
  if (dataUrlBytes(dataUrl) <= OCR_SPACE_MAX_BYTES) return dataUrl;

  const { canvas } = await loadToCanvas(dataUrl, MIN_OCR_WIDTH);
  const qualities = [0.9, 0.8, 0.7, 0.55, 0.4, 0.25];
  for (const q of qualities) {
    const candidate = canvas.toDataURL("image/jpeg", q);
    if (dataUrlBytes(candidate) <= OCR_SPACE_MAX_BYTES) return candidate;
  }
  // Last resort — smallest JPEG, even if slightly over.
  return canvas.toDataURL("image/jpeg", 0.2);
}

// Fetch with a timeout — OCR.space occasionally stalls and we don't want
// users staring at a spinner forever before the Tesseract fallback runs.
async function fetchWithTimeout(url, init, ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Call OCR.space. Resolves with the recognized text or throws on any error
// (network, rate limit, API error, empty result). The Tesseract fallback will
// pick up from there.
async function runOcrSpace(dataUrl, ocrEngine = "2") {
  const payload = await fitOcrSpacePayload(dataUrl);

  const form = new FormData();
  form.append("base64Image", payload);
  form.append("language", "eng");
  form.append("OCREngine", String(ocrEngine));
  form.append("scale", "true");
  form.append("isTable", "false");
  form.append("detectOrientation", "true");

  const response = await fetchWithTimeout(
    OCR_SPACE_ENDPOINT,
    {
      method: "POST",
      headers: { apikey: OCR_SPACE_API_KEY },
      body: form
    },
    OCR_SPACE_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`OCR.space HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.IsErroredOnProcessing) {
    const message = Array.isArray(json.ErrorMessage)
      ? json.ErrorMessage.join("; ")
      : String(json.ErrorMessage || "OCR.space reported an error");
    throw new Error(message);
  }

  const text = (json.ParsedResults || [])
    .map((r) => (r && r.ParsedText) || "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("OCR.space returned empty text");
  }

  return text;
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

function scoreIngredientOcr(text) {
  const s = sanitizeText(text);
  if (!s) return 0;
  let score = 0;
  const lower = s.toLowerCase();
  if (/ingredient/.test(lower)) score += 55;
  if (/\bcontains?\b/.test(lower)) score += 35;
  if (
    /\b(wheat|flour|sugar|salt|oil|water|milk|egg|corn|soy|butter|honey|starch)\b/.test(
      lower
    )
  ) {
    score += 30;
  }
  if (/[,:;]/.test(s)) score += 10;
  const words = lower.split(/\s+/).filter((w) => w.length > 1);
  score += Math.min(words.length * 1.2, 45);
  score += Math.min(s.length * 0.06, 35);
  const noise = (s.match(/[^A-Za-z0-9 ,.;:()\[\]%*\-/'"\n]/g) || []).length;
  score -= noise * 3;
  return score;
}

function pickBestOcrCandidate(entries) {
  let best = { text: "", score: -Infinity, source: "" };
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || typeof e.text !== "string" || !e.text.trim()) continue;
    const sc = scoreIngredientOcr(e.text);
    if (sc > best.score) {
      best = { text: e.text, score: sc, source: e.source || "" };
    }
  }
  return best;
}

// -----------------------------------------------------------------------------
// Engine runners
// -----------------------------------------------------------------------------

async function runTesseractWithPsm(processedDataUrl, psm) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract.js is not loaded");
  }
  const worker = await Tesseract.createWorker("eng", 1);
  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: String(psm),
      user_defined_dpi: "300"
    });
    const result = await worker.recognize(processedDataUrl);
    return textFromConfidentWords(result);
  } finally {
    try {
      await worker.terminate();
    } catch (_) {
      /* ignore */
    }
  }
}

async function runTesseractBest(processedDataUrl) {
  let a = "";
  let b = "";
  try {
    a = await runTesseractWithPsm(processedDataUrl, "4");
  } catch (e) {
    console.warn("Tesseract PSM4 failed:", e);
  }
  try {
    b = await runTesseractWithPsm(processedDataUrl, "6");
  } catch (e) {
    console.warn("Tesseract PSM6 failed:", e);
  }
  const sa = sanitizeText(a);
  const sb = sanitizeText(b);
  if (!sa && !sb) return "";
  if (!sa) return b;
  if (!sb) return a;
  return scoreIngredientOcr(a) >= scoreIngredientOcr(b) ? a : b;
}

// -----------------------------------------------------------------------------
// Main OCR flow
// -----------------------------------------------------------------------------
async function runOCRFlow() {
  try {
    setStepState(stepCapture, "completed", "Image captured");
    setStepState(stepRead, "active", "Reading ingredients...");
    setStepState(stepSafety, "pending", "Analyzing safety");

    const { processedDataUrl, stddev } = await preprocessImage(croppedImage);
    const naturalJpeg = await prepareNaturalImageForCloudOcr(croppedImage);

    // Blank / uniform image — bail before any engine hallucinates a label.
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

    // --- Cloud OCR: high-res color first, then alt engine / preprocess fallback
    const candidates = [];
    try {
      setStepState(stepRead, "active", "Reading ingredients (cloud OCR)...");
      const t = await runOcrSpace(naturalJpeg, "2");
      candidates.push({ text: t, source: "ocr.space-e2-natural" });
    } catch (cloudErr) {
      console.warn("OCR.space E2 natural failed:", cloudErr);
    }

    let best = pickBestOcrCandidate(candidates);
    const needAltEngine =
      candidates.length === 0 ||
      scoreIngredientOcr(best.text) < 48 ||
      sanitizeText(best.text).length < 70;

    if (needAltEngine) {
      try {
        setStepState(stepRead, "active", "Reading ingredients (cloud OCR)...");
        const t = await runOcrSpace(naturalJpeg, "1");
        candidates.push({ text: t, source: "ocr.space-e1-natural" });
      } catch (e) {
        console.warn("OCR.space E1 natural failed:", e);
      }
      best = pickBestOcrCandidate(candidates);
    }

    const tryProcessed =
      candidates.length === 0 ||
      scoreIngredientOcr(best.text) < 42 ||
      !looksLikeIngredients(sanitizeText(best.text));

    if (tryProcessed) {
      try {
        setStepState(stepRead, "active", "Reading ingredients (cloud OCR)...");
        const t = await runOcrSpace(processedDataUrl, "2");
        candidates.push({ text: t, source: "ocr.space-e2-processed" });
      } catch (e) {
        console.warn("OCR.space E2 processed failed:", e);
      }
      best = pickBestOcrCandidate(candidates);
    }

    let rawText = best.text || "";
    let engineUsed = best.source || "";

    const cloudSan = sanitizeText(rawText);
    const cloudWeak =
      !looksLikeIngredients(cloudSan) ||
      scoreIngredientOcr(rawText) < 38 ||
      cloudSan.length < 40;

    if (cloudWeak) {
      try {
        setStepState(stepRead, "active", "Reading ingredients (local OCR)...");
        const tesseractText = await runTesseractBest(processedDataUrl);
        const tessSan = sanitizeText(tesseractText);
        if (
          looksLikeIngredients(tessSan) &&
          (!looksLikeIngredients(cloudSan) ||
            scoreIngredientOcr(tesseractText) > scoreIngredientOcr(rawText) ||
            tessSan.length > cloudSan.length * 1.05)
        ) {
          rawText = tesseractText;
          engineUsed = "tesseract";
        }
      } catch (tessErr) {
        console.warn("Tesseract fallback failed:", tessErr);
      }
    }

    const sanitized = sanitizeText(rawText);

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
    try { sessionStorage.setItem("ocrEngine", engineUsed); } catch (_) { /* ignore */ }

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
