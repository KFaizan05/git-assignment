//Jenny Tran
//
// Wrapped in an async IIFE so every call site can rely on the client cache
// being hydrated — `profileStorage.getCurrentProfile()` at line ~42 below
// otherwise fires before `me.php` has answered and returns an empty profile.
(async function initResults() {
  "use strict";
  await profileStorage.ready();

const backBtn = document.getElementById("backBtn");
const homeBtn = document.getElementById("homeBtn");
const alternativesBtn = document.getElementById("alternativesBtn");

const productName = document.getElementById("productName");
const brandName = document.getElementById("brandName");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const ingredientList = document.getElementById("ingredientList");
const rawOcrText = document.getElementById("rawOcrText");
const renameBtn = document.getElementById("renameBtn");
const productNameInput = document.getElementById("productNameInput");

// Top-level verdict card + its icon. results.js toggles .safe / .caution /
// .unsafe on the card so the green/yellow/red palette matches the verdict.
const statusCard = document.querySelector(".status-card");
const statusIcon = document.querySelector(".status-card .status-icon");

// Paint the verdict card's color + icon glyph to match the computed status.
// Call this from every branch that sets overallStatus so the box color and
// the per-ingredient tags never drift out of sync.
function applyStatusCardStyle(status) {
  if (!statusCard) return;
  statusCard.classList.remove("safe", "caution", "unsafe");
  const key = String(status || "").toLowerCase();
  if (key === "safe") {
    statusCard.classList.add("safe");
    if (statusIcon) statusIcon.textContent = "\u2713"; // ✓
  } else if (key === "unsafe") {
    statusCard.classList.add("unsafe");
    if (statusIcon) statusIcon.textContent = "\u2715"; // ✕
  } else {
    statusCard.classList.add("caution");
    if (statusIcon) statusIcon.textContent = "!";
  }
}

// Pull the CURRENT user's profile (per-account isolated slot).
// profileStorage returns an empty profile if nobody is logged in.
const savedProfile = profileStorage.getCurrentProfile();
const userAllergens = savedProfile.allergens || [];
const userDietary = savedProfile.dietary || [];
const userCustomAllergens = Array.isArray(savedProfile.customAllergens)
  ? savedProfile.customAllergens.map((s) => String(s || "").trim()).filter(Boolean)
  : [];
const userName = savedProfile.name || "";

// Escape a free-form allergen string for use inside a RegExp.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a case-insensitive word-boundary regex for a custom allergen.
function buildCustomAllergenRegex(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  // Split on whitespace, escape each part, rejoin with flexible separators.
  const parts = trimmed.split(/\s+/).map(escapeRegex);
  const core = parts.length > 1 ? parts.join("[^a-z0-9]+") : parts[0];
  try {
    return new RegExp(`(^|[^a-z0-9])${core}($|[^a-z0-9])`, "i");
  } catch (err) {
    console.warn("Bad custom allergen regex:", raw, err);
    return null;
  }
}

const userCustomAllergenRegexes = userCustomAllergens
  .map((term) => ({ term, regex: buildCustomAllergenRegex(term) }))
  .filter((x) => x.regex);

// Detect a "revisit" — the user tapped a card in Scan History / Recent
// Scans / Safe Items.
const revisitScanId = sessionStorage.getItem("revisitScanId") || "";
const revisitProductName = sessionStorage.getItem("revisitProductName") || "";
const revisitOrigin = sessionStorage.getItem("revisitOrigin") || "";
// Clear the hand-off keys so refreshes / next scans don't re-trigger
// revisit mode.
sessionStorage.removeItem("revisitScanId");
sessionStorage.removeItem("revisitProductName");
sessionStorage.removeItem("revisitOrigin");

//Get OCR extracted text
const ocrText = sessionStorage.getItem("ocrText") || "";
//Displays the raw OCR text for debug and visibilty
rawOcrText.textContent = ocrText || "No text found.";

// Track the id of the scan record tied to this view so rename can patch it.
let currentScanId = revisitScanId || "";

backBtn.addEventListener("click", () => {
  // Origin-aware back navigation: when this view was opened by tapping a
  // saved scan on Dashboard / Scan History / Safe Items, go straight back
  // to that page. Falls back to the normal history/ScanPage behavior for
  // fresh scans that didn't come from a saved tile.
  if (revisitOrigin) {
    window.location.href = revisitOrigin;
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "ScanPage.html";
  }
});

homeBtn.addEventListener("click", () => {
  window.location.href = "DashboardPage.html";
});

alternativesBtn.addEventListener("click", () => {
  window.location.href = "AlternativesPage.html";
});

// Extract the ingredients body from free OCR text.
function extractIngredients(text) {
  const normalized = text.replace(/\r/g, "").trim();

  const patterns = [
    /ingredients?\s*[:\-]\s*([\s\S]*)/i,
    /ingredients?\s+([\s\S]*)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      let extracted = match[1].trim();
      // Drop clearly non-ingredient trailing sections (nutrition, warnings,
      // distributed-by, allergy banners). The "contains" allergy line is
      // pulled out separately by extractAllergyStatement() on the full text,
      // so we don't lose it by cutting the allergy section here.
      extracted = extracted
        .split(/\n\s*(allergy\s+information|allergen|distributed by|manufactured by|nutrition facts|warning|directions|storage|keep refrigerated)\b/i)[0]
        .trim();

      return extracted || null;
    }
  }

  return null;
}

// Pull out any explicit "Contains: X, Y" allergy line. Works whether or not
// the line is prefixed with "ALLERGY INFORMATION:". Returns the full list
// after "CONTAINS" as a lowercase string, or "".
function extractAllergyStatement(text) {
  if (!text) return "";
  const normalized = text.replace(/\r/g, "");
  // Match "contains" as a standalone keyword (not "contains less than 2%").
  const match = normalized.match(/contains(?!\s+less\s+than)\s*[:\-]?\s*([^\n.]+)/i);
  if (match && match[1]) {
    return match[1].toLowerCase().trim();
  }
  return "";
}

// Pick up "made in a facility that processes X" / "may contain X" lines.
function extractMayContainStatement(text) {
  if (!text) return "";
  const normalized = text.replace(/\r/g, "");
  const match = normalized.match(/(?:may contain|processes|shared (?:equipment|facility))[^\n.]*/i);
  return match ? match[0].toLowerCase().trim() : "";
}

// Map each checkbox-level allergen the user can pick in their profile to the
// full set of ingredient keywords that should trigger it. A user who checks
// "Tree Nuts" should be warned about EVERY kind of tree nut (almonds,
// cashews, walnuts, pistachios, etc.) — the profile pill is an umbrella,
// not a literal string match.
const ALLERGEN_KEYWORDS = {
  "Peanuts": ["peanut", "groundnut", "arachis"],
  "Tree Nuts": [
    "tree nut",
    "almond",
    "cashew",
    "walnut",
    "pecan",
    "pistachio",
    "hazelnut",
    "filbert",
    "brazil nut",
    "macadamia",
    "pine nut",
    "pinon",
    "chestnut",
    "beech nut",
    "butternut",
    "lichee nut",
    "nangai nut",
    "shea nut",
    "marzipan",
    "praline",
    "nougat",
    "gianduja"
  ],
  "Milk": ["milk", "dairy", "butter", "cheese", "cream", "yogurt", "whey", "casein", "lactose", "ghee"],
  "Eggs": ["egg", "albumin", "albumen", "ovalbumin", "mayonnaise", "meringue"],
  "Soy": ["soy", "soya", "soybean", "edamame", "tofu", "tempeh", "miso"],
  "Wheat": ["wheat", "flour", "semolina", "spelt", "farro", "bulgur", "couscous", "gluten", "seitan"],
  "Fish": [
    "fish", "anchovy", "bass", "cod", "flounder", "grouper", "haddock", "hake",
    "halibut", "herring", "mackerel", "mahi", "perch", "pike", "pollock",
    "salmon", "sardine", "snapper", "sole", "swordfish", "tilapia", "trout",
    "tuna"
  ],
  "Shellfish": [
    "shellfish", "shrimp", "prawn", "crab", "lobster", "crawfish", "crayfish",
    "langoustine", "clam", "mussel", "oyster", "scallop", "squid", "octopus",
    "calamari"
  ],
  "Sesame": ["sesame", "tahini", "benne", "gingelly"]
};

// Dietary preferences the user can select — these aren't personal allergens
// but still inform the Caution/Unsafe verdict.
const DIETARY_KEYWORDS = {
  "Vegan": ["milk", "dairy", "butter", "cheese", "cream", "egg", "honey", "gelatin", "whey", "casein", "lard", "beef", "pork", "chicken", "fish", "anchovy"],
  "Vegetarian": ["gelatin", "beef", "pork", "chicken", "fish", "anchovy", "lard"],
  "Gluten-Free": ["wheat", "flour", "semolina", "spelt", "farro", "barley", "rye", "gluten"],
  "Dairy-Free": ["milk", "dairy", "butter", "cheese", "cream", "yogurt", "whey", "casein", "lactose", "ghee"],
  "Halal": ["pork", "bacon", "ham", "gelatin", "lard", "alcohol", "wine", "rum"],
  "Kosher": ["pork", "bacon", "ham", "shellfish", "shrimp", "crab", "lobster"]
};

// "Caution" ingredients that aren't specific to a user profile but are worth
// flagging for a closer look.
const GENERIC_CAUTION_KEYWORDS = [
  "sugar", "natural flavor", "flavoring", "artificial", "color", "dye",
  "high fructose", "corn syrup", "preservative"
];

function matchesAny(haystack, keywords) {
  return keywords.some((kw) => haystack.includes(kw));
}

// Which FDA Big-9 allergen category does this ingredient string fall under?
// Returns the allergen label (e.g. "Tree Nuts") or null. Used to flag ANY
// major allergen regardless of whether the user has it in their profile —
// so a label with almonds still reads as at minimum Caution for everyone.
function detectMajorAllergen(lower) {
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (matchesAny(lower, keywords)) return allergen;
  }
  return null;
}

// Returns { status, note }. Uses the signed-in user's allergens + dietary
// preferences (fetched into userAllergens / userDietary above) to decide.
function analyzeIngredient(name) {
  const lower = String(name || "").toLowerCase();

  // 1. User-profile allergen match — highest priority, always Unsafe.
  for (const allergen of userAllergens) {
    const keywords = ALLERGEN_KEYWORDS[allergen] || [String(allergen).toLowerCase()];
    if (matchesAny(lower, keywords)) {
      return {
        status: "Unsafe",
        note: `Contains ${allergen.toLowerCase()} — listed as an allergen in your profile.`
      };
    }
  }

  // 1b. Custom user-defined allergens — treated the same as profile allergens.
  for (const { term, regex } of userCustomAllergenRegexes) {
    if (regex.test(lower)) {
      return {
        status: "Unsafe",
        note: `Contains ${term.toLowerCase()} — listed in your custom allergens.`
      };
    }
  }

  // 2. Dietary preference violation — also Unsafe (it breaks the user's diet).
  for (const diet of userDietary) {
    const keywords = DIETARY_KEYWORDS[diet];
    if (keywords && matchesAny(lower, keywords)) {
      return {
        status: "Unsafe",
        note: `Not compatible with your ${diet} preference.`
      };
    }
  }

  // 3. Major allergen present but NOT in the user's profile — still show
  //    Caution so the user sees it. They can dismiss if it's fine for them.
  const majorAllergen = detectMajorAllergen(lower);
  if (majorAllergen) {
    return {
      status: "Caution",
      note: `Contains ${majorAllergen.toLowerCase()} — a common allergen. Review if this is safe for you.`
    };
  }

  // 4. Generic caution keywords — flag but don't block.
  if (matchesAny(lower, GENERIC_CAUTION_KEYWORDS)) {
    return {
      status: "Caution",
      note: "May need closer review (common additive or sweetener)."
    };
  }

  return {
    status: "Safe",
    note: "No obvious issue detected"
  };
}

// Analyze an explicit "CONTAINS X, Y" allergy statement from the label.
// Returns { matchedUserAllergens, matchedCustomAllergens, majorAllergens }.
function analyzeAllergyStatement(statementLower) {
  if (!statementLower) {
    return { matchedUserAllergens: [], matchedCustomAllergens: [], majorAllergens: [] };
  }

  const matchedUserAllergens = new Set();
  const matchedCustomAllergens = new Set();
  const majorAllergens = new Set();

  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (matchesAny(statementLower, keywords)) {
      majorAllergens.add(allergen);
      if (userAllergens.includes(allergen)) {
        matchedUserAllergens.add(allergen);
      }
    }
  }

  // Check explicit custom allergens against the statement too.
  for (const { term, regex } of userCustomAllergenRegexes) {
    if (regex.test(statementLower)) {
      matchedCustomAllergens.add(term);
    }
  }

  return {
    matchedUserAllergens: [...matchedUserAllergens],
    matchedCustomAllergens: [...matchedCustomAllergens],
    majorAllergens: [...majorAllergens]
  };
}

function renderIngredientCard(name, status, note) {
  // Normalize the class to lowercase so it matches the CSS selectors
  // (.ingredient-item.safe / .tag.safe etc.) regardless of whether the
  // caller passed "Safe" or "safe". The visible label is capitalized via
  // `text-transform: capitalize` in CSS.
  const cls = String(status || "").toLowerCase();
  const label = cls ? cls.charAt(0).toUpperCase() + cls.slice(1) : "";
  return `
    <div class="ingredient-item ${cls}">
      <div class="ingredient-top">
        <div class="ingredient-name">${name}</div>
        <div class="tag ${cls}">${label}</div>
      </div>
      <div class="ingredient-note">${note}</div>
    </div>
  `;
}

// Track the overall verdict so we can save it to this user's scan history.
let overallStatus = "Safe";
let overallNote = "No obvious concerns were detected in the extracted ingredients.";

const extracted = extractIngredients(ocrText);

// Check the explicit "CONTAINS X, Y" allergy statement and the
// "MAY CONTAIN / processes Z" warning line.
const allergyStatement = extractAllergyStatement(ocrText);
const mayContainStatement = extractMayContainStatement(ocrText);
const allergyFindings = analyzeAllergyStatement(allergyStatement);
const mayContainFindings = analyzeAllergyStatement(mayContainStatement);

if (extracted) {
  const items = extracted
    .split(/,(?![^(]*\))/)
    .map(item => item.trim())
    .filter(Boolean);

  if (items.length > 0) {
    const analyses = items.map((item) => ({ item, analysis: analyzeIngredient(item) }));

    // If the label has a "CONTAINS: almonds, milk" line, surface it as its
    // own card at the top so the user sees it was detected even when the
    // ingredients list is long.
    let allergyCardHtml = "";
    if (allergyFindings.majorAllergens.length || allergyFindings.matchedCustomAllergens.length) {
      const userHit = allergyFindings.matchedUserAllergens.length > 0
        || allergyFindings.matchedCustomAllergens.length > 0;
      const listedItems = [
        ...allergyFindings.majorAllergens.map((a) => a.toLowerCase()),
        ...allergyFindings.matchedCustomAllergens.map((a) => a.toLowerCase())
      ];
      const userHitNames = [
        ...allergyFindings.matchedUserAllergens,
        ...allergyFindings.matchedCustomAllergens
      ];
      allergyCardHtml = renderIngredientCard(
        `Allergy statement: contains ${listedItems.join(", ")}`,
        userHit ? "Unsafe" : "Caution",
        userHit
          ? `Label explicitly lists ${userHitNames.join(" & ").toLowerCase()} — in your allergen profile.`
          : "Label explicitly lists major allergens. Review if these are safe for you."
      );
    }

    ingredientList.innerHTML =
      allergyCardHtml +
      analyses
        .map(({ item, analysis }) =>
          renderIngredientCard(item, analysis.status, analysis.note)
        )
        .join("");

    const hasUnsafe =
      analyses.some(({ analysis }) => analysis.status === "Unsafe") ||
      allergyFindings.matchedUserAllergens.length > 0 ||
      allergyFindings.matchedCustomAllergens.length > 0;

    const hasUserCaution =
      mayContainFindings.matchedUserAllergens.length > 0 ||
      mayContainFindings.matchedCustomAllergens.length > 0;

    if (hasUnsafe) {
      const profileHits = [
        ...allergyFindings.matchedUserAllergens,
        ...allergyFindings.matchedCustomAllergens
      ];
      overallStatus = "Unsafe";
      overallNote = profileHits.length > 0
        ? `This product contains ${profileHits.join(" & ").toLowerCase()} — listed in your allergen profile.`
        : "This product contains ingredients that conflict with your profile.";
      statusTitle.textContent = "Unsafe Ingredients";
      statusMessage.textContent = overallNote;
      applyStatusCardStyle(overallStatus);
    } else if (hasUserCaution) {
      overallStatus = "Caution";
      const cautionHits = [
        ...mayContainFindings.matchedUserAllergens,
        ...mayContainFindings.matchedCustomAllergens
      ];
      overallNote = `This product may contain traces of ${cautionHits.join(" & ").toLowerCase()} (shared facility) — listed in your profile.`;
      statusTitle.textContent = "Caution Required";
      statusMessage.textContent = overallNote;
      applyStatusCardStyle(overallStatus);
    } else {
      overallStatus = "Safe";
      // Tailor the copy depending on whether the user actually has a
      // profile worth checking against — avoids the somewhat misleading
      // "no concerns" line for someone who hasn't set any allergens yet.
      const hasProfile =
        userAllergens.length > 0 ||
        userCustomAllergens.length > 0 ||
        userDietary.length > 0;
      overallNote = hasProfile
        ? "No allergens or restrictions from your profile were detected in this product."
        : "No obvious concerns were detected in the extracted ingredients.";
      statusTitle.textContent = "Safe";
      statusMessage.textContent = overallNote;
      applyStatusCardStyle(overallStatus);
    }

    productName.textContent = revisitProductName || "Scanned Product";
    brandName.textContent = `Ingredients Detected: ${items.length}`;
  } else {
    overallStatus = "Caution";
    overallNote = "Text was detected, but unable to extract cleanly.";
    ingredientList.innerHTML = renderIngredientCard(
      "No Structured Ingredients Found",
      "caution",
      overallNote
    );
    applyStatusCardStyle(overallStatus);
  }
} else if (allergyFindings.majorAllergens.length > 0) {
  // Ingredients list didn't parse cleanly, but we still caught an explicit
  // "CONTAINS X" line. Only flag Unsafe if X is in the user's profile;
  // otherwise the verdict is Safe (per the user-profile-driven rule).
  const userHit =
    allergyFindings.matchedUserAllergens.length > 0 ||
    allergyFindings.matchedCustomAllergens.length > 0;
  const userHitNames = [
    ...allergyFindings.matchedUserAllergens,
    ...allergyFindings.matchedCustomAllergens
  ];
  overallStatus = userHit ? "Unsafe" : "Safe";
  overallNote = userHit
    ? `This product contains ${userHitNames.join(" & ").toLowerCase()} — listed in your allergen profile.`
    : "No allergens or restrictions from your profile were detected in this product.";
  statusTitle.textContent = userHit ? "Unsafe Ingredients" : "Safe";
  statusMessage.textContent = overallNote;
  ingredientList.innerHTML = renderIngredientCard(
    `Allergy statement: contains ${allergyFindings.majorAllergens.map((a) => a.toLowerCase()).join(", ")}`,
    userHit ? "Unsafe" : "Caution",
    userHit
      ? overallNote
      : "Label lists common allergens for informational purposes. None are in your profile."
  );
  applyStatusCardStyle(overallStatus);
} else {
  overallStatus = "Caution";
  overallNote = "Failed to confidently identify ingredients.";
  ingredientList.innerHTML = renderIngredientCard(
    "Ingredients Not Clearly Found",
    "caution",
    overallNote
  );
  applyStatusCardStyle(overallStatus);
}

// If this is a revisit (user tapped a saved scan), make sure the custom
// name they chose last time shows up no matter which branch above ran.
if (revisitProductName) {
  productName.textContent = revisitProductName;
}

// ---- Rename "Scanned Product" -------------------------------------------
// Small edit-in-place flow: click the pencil → swap in the input → press
// Enter / click away to save. The new name is pushed back into the scan
// record (via profileStorage.updateCurrentScan) so Scan History, Recent
// Scans, and Safe Items all show the name the user chose.
(function initRename() {
  if (!renameBtn || !productNameInput) return;

  function enterEditMode() {
    productNameInput.value =
      productName.textContent === "Scanned Product"
        ? ""
        : productName.textContent || "";
    productName.hidden = true;
    renameBtn.hidden = true;
    productNameInput.hidden = false;
    // Defer focus so the input is actually in the layout.
    setTimeout(() => {
      productNameInput.focus();
      productNameInput.select();
    }, 0);
  }

  function exitEditMode(save) {
    if (save) {
      const raw = productNameInput.value.trim();
      const finalName = raw || "Scanned Product";
      productName.textContent = finalName;
      if (currentScanId) {
        profileStorage
          .updateCurrentScan(currentScanId, { productName: finalName })
          .catch((err) => console.warn("Could not persist renamed scan:", err));
      }
    }
    productNameInput.hidden = true;
    productName.hidden = false;
    renameBtn.hidden = false;
  }

  renameBtn.addEventListener("click", enterEditMode);

  productNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      exitEditMode(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      exitEditMode(false);
    }
  });

  // Commit on blur so clicking anywhere else saves the edit.
  productNameInput.addEventListener("blur", () => exitEditMode(true));
})();

// Build a tiny square thumbnail (data URL) from a full-size image data URL so
// Scan History can render a visual preview without blowing localStorage.
// Returns "" if there's no source image (e.g. manual paste flow) or the
// source fails to decode — callers fall back to the status icon.
function buildScanThumbnail(sourceDataUrl, maxDim = 128, quality = 0.6) {
  return new Promise((resolve) => {
    if (!sourceDataUrl || typeof sourceDataUrl !== "string") {
      resolve("");
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const sw = img.naturalWidth;
        const sh = img.naturalHeight;
        if (!sw || !sh) return resolve("");
        // Center-crop to a square so every history card has a uniform tile.
        const side = Math.min(sw, sh);
        const sx = (sw - side) / 2;
        const sy = (sh - side) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = maxDim;
        canvas.height = maxDim;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxDim, maxDim);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (_) {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = sourceDataUrl;
  });
}

// Persist this scan into the current user's isolated scan history so
// ScanHistoryPage / SafeItemsPage / Dashboard can render it.
(async function persistScan() {
  if (!ocrText) return;
  if (!profileStorage.getCurrentUser()) return;

  // Revisit mode: we're just re-rendering an existing scan record. Don't
  // create a new one. currentScanId is already set to the revisited id.
  if (revisitScanId) return;

  const persistKey = "labelwiseLastSavedOcr";
  if (sessionStorage.getItem(persistKey) === ocrText) return;

  // Prefer the cropped image (the one OCR actually ran on) so the tile
  // matches what the user confirmed. Fall back to the raw capture if
  // somehow crop didn't happen. Manual paste leaves both empty → "".
  const source =
    sessionStorage.getItem("croppedImage") ||
    sessionStorage.getItem("capturedImage") ||
    "";
  let thumbnail = "";
  try {
    thumbnail = await buildScanThumbnail(source);
  } catch (_) {
    thumbnail = "";
  }

  // Build the scan payload once so both the with-thumbnail save and the
  // quota-retry use the same shape. Persisting ocrText lets the history
  // card click re-open this exact result page without re-OCRing.
  const basePayload = {
    productName: (productName.textContent || "Scanned Product").trim(),
    brandName: "",
    status: overallStatus,
    category: "",
    note: overallNote,
    savedToSafe: false,
    ocrText
  };

  try {
    const saved = await profileStorage.addCurrentScan({ ...basePayload, thumbnail });
    if (saved && saved.id) currentScanId = saved.id;
  } catch (err) {
    // Retry without the big base64 thumbnail so the scan record itself still
    // gets saved even if the server rejects the payload for being too large
    // (e.g. post-MAX_ALLOWED_PACKET truncation, or a slow-path rejection).
    console.warn("Scan save failed with thumbnail, retrying without:", err);
    try {
      const saved = await profileStorage.addCurrentScan({ ...basePayload, thumbnail: "" });
      if (saved && saved.id) currentScanId = saved.id;
    } catch (err2) {
      console.warn("Scan save failed even without thumbnail:", err2);
    }
  }

  sessionStorage.setItem(persistKey, ocrText);
})();
})();