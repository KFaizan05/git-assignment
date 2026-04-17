//Jenny Tran
//
const backBtn = document.getElementById("backBtn");
const homeBtn = document.getElementById("homeBtn");
const alternativesBtn = document.getElementById("alternativesBtn");

const productName = document.getElementById("productName");
const brandName = document.getElementById("brandName");
const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const ingredientList = document.getElementById("ingredientList");
const rawOcrText = document.getElementById("rawOcrText");

// Pull the CURRENT user's profile (per-account isolated slot).
// profileStorage returns an empty profile if nobody is logged in.
const savedProfile = profileStorage.getCurrentProfile();
const userAllergens = savedProfile.allergens || [];
const userDietary = savedProfile.dietary || [];
const userName = savedProfile.name || "";

//Get OCR extracted text
const ocrText = sessionStorage.getItem("ocrText") || "";
//Displays the raw OCR text for debug and visibilty 
rawOcrText.textContent = ocrText || "No text found.";

backBtn.addEventListener("click", () => {
  window.location.href = "ScanPage.html";
});

homeBtn.addEventListener("click", () => {
  window.location.href = "DashboardPage.html";
});

alternativesBtn.addEventListener("click", () => {
  window.location.href = "AlternativesPage.html";
});

// Extract the ingredients body from free OCR text. We used to split on
// "contains" here, which accidentally chopped off the "CONTAINS ALMONDS &
// CASEIN" allergy statement — the single most useful line for allergen
// detection. Now we only split on sections that clearly aren't ingredients
// (Nutrition Facts, Distributed By, Manufactured By). The CONTAINS /
// ALLERGY line stays in — it gets picked up separately by
// extractAllergyStatement() below.
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
// but still inform the Caution/Unsafe verdict. Keep this list loose; we only
// flag Caution (not Unsafe) unless an actual allergen matches.
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
// Returns { matchedUserAllergens, majorAllergens }.
function analyzeAllergyStatement(statementLower) {
  if (!statementLower) return { matchedUserAllergens: [], majorAllergens: [] };

  const matchedUserAllergens = new Set();
  const majorAllergens = new Set();

  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (matchesAny(statementLower, keywords)) {
      majorAllergens.add(allergen);
      if (userAllergens.includes(allergen)) {
        matchedUserAllergens.add(allergen);
      }
    }
  }
  return {
    matchedUserAllergens: [...matchedUserAllergens],
    majorAllergens: [...majorAllergens]
  };
}

function renderIngredientCard(name, status, note) {
  return `
    <div class="ingredient-item ${status}">
      <div class="ingredient-top">
        <div class="ingredient-name">${name}</div>
        <div class="tag ${status}">${status}</div>
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
// "MAY CONTAIN / processes Z" warning line. These are strong signals even
// if the ingredients list itself is partially clipped by OCR.
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
    if (allergyFindings.majorAllergens.length) {
      const userHit = allergyFindings.matchedUserAllergens.length > 0;
      allergyCardHtml = renderIngredientCard(
        `Allergy statement: contains ${allergyFindings.majorAllergens.map((a) => a.toLowerCase()).join(", ")}`,
        userHit ? "Unsafe" : "Caution",
        userHit
          ? `Label explicitly lists ${allergyFindings.matchedUserAllergens.join(" & ").toLowerCase()} — in your allergen profile.`
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
      allergyFindings.matchedUserAllergens.length > 0;
    const hasCaution =
      analyses.some(({ analysis }) => analysis.status === "Caution") ||
      allergyFindings.majorAllergens.length > 0 ||
      mayContainFindings.majorAllergens.length > 0;

    if (hasUnsafe) {
      overallStatus = "Unsafe";
      overallNote = allergyFindings.matchedUserAllergens.length > 0
        ? `This product contains ${allergyFindings.matchedUserAllergens.join(" & ").toLowerCase()} — listed in your allergen profile.`
        : "This product appears to contain ingredients that may be unsuitable.";
      statusTitle.textContent = "Unsafe Ingredients";
      statusMessage.textContent = overallNote;
    } else if (hasCaution) {
      overallStatus = "Caution";
      if (allergyFindings.majorAllergens.length > 0) {
        overallNote = `This product contains common allergens (${allergyFindings.majorAllergens.map((a) => a.toLowerCase()).join(", ")}). Review before consuming.`;
      } else if (mayContainFindings.majorAllergens.length > 0) {
        overallNote = `This product may contain traces of ${mayContainFindings.majorAllergens.map((a) => a.toLowerCase()).join(", ")} (shared facility).`;
      } else {
        overallNote = "This product may contain concerning ingredients.";
      }
      statusTitle.textContent = "Caution Required";
      statusMessage.textContent = overallNote;
    } else {
      overallStatus = "Safe";
      overallNote = "No obvious concerns were detected in the extracted ingredients.";
      statusTitle.textContent = "Safe";
      statusMessage.textContent = overallNote;
    }

    productName.textContent = "Scanned Product";
    brandName.textContent = `Ingredients Detected: ${items.length}`;
  } else {
    overallStatus = "Caution";
    overallNote = "Text was detected, but unable to extract cleanly.";
    ingredientList.innerHTML = renderIngredientCard(
      "No Structured Ingredients Found",
      "caution",
      overallNote
    );
  }
} else if (allergyFindings.majorAllergens.length > 0) {
  // Ingredients list didn't parse cleanly, but we still caught an explicit
  // "CONTAINS X" line — that's enough to flag the product.
  const userHit = allergyFindings.matchedUserAllergens.length > 0;
  overallStatus = userHit ? "Unsafe" : "Caution";
  overallNote = userHit
    ? `This product contains ${allergyFindings.matchedUserAllergens.join(" & ").toLowerCase()} — listed in your allergen profile.`
    : `This product contains common allergens (${allergyFindings.majorAllergens.map((a) => a.toLowerCase()).join(", ")}).`;
  statusTitle.textContent = userHit ? "Unsafe Ingredients" : "Caution Required";
  statusMessage.textContent = overallNote;
  ingredientList.innerHTML = renderIngredientCard(
    `Allergy statement: contains ${allergyFindings.majorAllergens.map((a) => a.toLowerCase()).join(", ")}`,
    userHit ? "Unsafe" : "Caution",
    overallNote
  );
} else {
  overallStatus = "Caution";
  overallNote = "Failed to confidently identify ingredients.";
  ingredientList.innerHTML = renderIngredientCard(
    "Ingredients Not Clearly Found",
    "caution",
    overallNote
  );
}

// Persist this scan into the current user's isolated scan history so
// ScanHistoryPage / SafeItemsPage / Dashboard can render it. Guarded by
// an `ocrText` check so we don't spam the history on refresh with no data.
// sessionStorage key `resultsPersistedKey` prevents double-saves on reloads
// of the same Results view.
(function persistScan() {
  if (!ocrText) return;
  if (!profileStorage.getCurrentUser()) return;

  const persistKey = "labelwiseLastSavedOcr";
  if (sessionStorage.getItem(persistKey) === ocrText) return;

  profileStorage.addCurrentScan({
    productName: (productName.textContent || "Scanned Product").trim(),
    brandName: "",
    status: overallStatus,
    category: "",
    note: overallNote,
    savedToSafe: overallStatus === "Safe"
  });

  sessionStorage.setItem(persistKey, ocrText);
})();