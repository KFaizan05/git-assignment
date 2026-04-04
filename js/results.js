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
  alert("Safe alternatives page coming soon.");
});

//Extract ingredients
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
      extracted = extracted
        .split(/\n\s*(contains|distributed by|warning|nutrition facts|manufactured by|may contain)\b/i)[0]
        .trim();

      return extracted || null;
    }
  }

  return null;
}

//Classification logic placeholder (not yet fully completed)
function analyzeIngredient(name) {
  const lower = name.toLowerCase();

  if (
    lower.includes("almond") ||
    lower.includes("peanut") ||
    lower.includes("tree nut") ||
    lower.includes("gelatin") ||
    lower.includes("pork")
  ) {
    return {
      status: "Unsafe",
      note: "Potential dietary or allergen concern"
    };
  }

  if (
    lower.includes("sugar") ||
    lower.includes("natural flavor") ||
    lower.includes("flavoring") ||
    lower.includes("color")
  ) {
    return {
      status: "Caution",
      note: "May need closer review"
    };
  }

  return {
    status: "Safe",
    note: "No obvious issue detected"
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

const extracted = extractIngredients(ocrText);

if (extracted) {
  const items = extracted
    .split(/,(?![^(]*\))/)
    .map(item => item.trim())
    .filter(Boolean);

  if (items.length > 0) {
    ingredientList.innerHTML = items
      .map(item => {
        const analysis = analyzeIngredient(item);
        return renderIngredientCard(item, analysis.status, analysis.note);
      })
      .join("");

    const hasUnsafe = items.some(item => analyzeIngredient(item).status === "unsafe");
    const hasCaution = items.some(item => analyzeIngredient(item).status === "caution");

    if (hasUnsafe) {
      statusTitle.textContent = "Unsafe Ingredients";
      statusMessage.textContent = "This product appears to contain ingredients that may be unsuitable.";
    } else if (hasCaution) {
      statusTitle.textContent = "Caution Required";
      statusMessage.textContent = "This product may contain concerning ingredients.";
    } else {
      statusTitle.textContent = "Safe";
      statusMessage.textContent = "No obvious concerns were detected in the extracted ingredients.";
    }

    productName.textContent = "Scanned Product";
    brandName.textContent = `Ingredients Detected: ${items.length}`;
  } else {
    ingredientList.innerHTML = renderIngredientCard(
      "No Structured Ingredients Found",
      "caution",
      "Text was detected, but unable to extract cleanly."
    );
  }
} else {
  ingredientList.innerHTML = renderIngredientCard(
    "Ingredients Not Clearly Found",
    "caution",
    "Failed to confidently identify ingredients."
  );
}