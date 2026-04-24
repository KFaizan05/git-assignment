(async function initAlternatives() {
  "use strict";

  // Hydrate from the server before reading cached scans.
  await profileStorage.ready();

  const backBtn = document.getElementById("backBtn");
  const homeBtn = document.getElementById("homeBtn");
  const originalCard = document.getElementById("originalCard");
  const originalName = document.getElementById("originalName");
  const originalNote = document.getElementById("originalNote");
  const alternativesList = document.getElementById("alternativesList");
  const emptyState = document.getElementById("emptyState");
  const OPENAI_API_KEY = String(window.__LABELWISE_OPENAI_API_KEY__ || "").trim();

  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "DashboardPage.html";
    }
  });

  homeBtn.addEventListener("click", () => {
    window.location.href = "DashboardPage.html";
  });

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildProfileSummary() {
    const profile = profileStorage.getCurrentProfile();
    const dietary = Array.isArray(profile.dietary) ? profile.dietary : [];
    const allergens = Array.isArray(profile.allergens) ? profile.allergens : [];
    const customAllergens = Array.isArray(profile.customAllergens) ? profile.customAllergens : [];
    return {
      dietary,
      allergens,
      customAllergens
    };
  }

  // Prefer the exact scan context from ResultsPage click, then fall back to
  // the newest non-safe scan in storage.
  function findScanSource() {
    const fromResultsName = sessionStorage.getItem("alternativesProductName") || "";
    const fromResultsOcr = sessionStorage.getItem("alternativesOcrText") || "";
    const fromResultsStatus = sessionStorage.getItem("alternativesStatus") || "";
    const fromResultsNote = sessionStorage.getItem("alternativesNote") || "";
    if (fromResultsName || fromResultsOcr) {
      return {
        productName: fromResultsName || "Scanned Product",
        ocrText: fromResultsOcr,
        status: fromResultsStatus || "Caution",
        note: fromResultsNote || ""
      };
    }

    if (!profileStorage.getCurrentUser()) return null;
    const scans = profileStorage.getCurrentScans();
    return scans.find((scan) => scan.status && scan.status !== "Safe") || null;
  }

  async function fetchSafeAlternatives(source) {
    if (!OPENAI_API_KEY) {
      throw new Error("Missing OpenAI API key in openai-config.local.js");
    }

    const profile = buildProfileSummary();
    const ocrSnippet = String(source.ocrText || "").slice(0, 2000);
    const prompt = [
      "Give safe product alternatives as strict JSON only.",
      `Scanned product: ${source.productName || "Scanned Product"}`,
      `Scan status: ${source.status || "Caution"}`,
      `Scan note: ${source.note || ""}`,
      `OCR ingredients text: ${ocrSnippet || "Not available"}`,
      `Dietary preferences: ${profile.dietary.join(", ") || "None"}`,
      `Allergens to avoid: ${profile.allergens.join(", ") || "None"}`,
      `Custom allergens to avoid: ${profile.customAllergens.join(", ") || "None"}`,
      "Return JSON with shape:",
      '{"alternatives":[{"name":"", "whySafe":"", "keyBenefits":["",""], "priceHint":"", "ratingHint":"", "availabilityHint":""}]}',
      "Return 3 alternatives max. Keep fields concise."
    ].join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "You are a food safety assistant that returns valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const payload = await res.json();
    if (payload.error) throw new Error(payload.error.message || "Failed to fetch alternatives.");

    const content = payload?.choices?.[0]?.message?.content || "{}";
    const normalized = String(content)
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3) : [];
  }

  function renderAlternatives(alternatives) {
    if (!alternatives.length) {
      alternativesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✨</div>
          <h3>No alternatives found</h3>
          <p>Try scanning another product for better matches.</p>
        </div>
      `;
      return;
    }

    alternativesList.innerHTML = alternatives.map((alt) => {
      const name = escapeHtml(alt.name || "Suggested Alternative");
      const whySafe = escapeHtml(alt.whySafe || "This option appears safer for your saved profile.");
      const benefits = Array.isArray(alt.keyBenefits) ? alt.keyBenefits.slice(0, 3) : [];
      const tagsHtml = benefits.map((b) => `<span class="pill safe">${escapeHtml(b)}</span>`).join("");
      const price = escapeHtml(alt.priceHint || "Varies");
      const rating = escapeHtml(alt.ratingHint || "N/A");
      const availability = escapeHtml(alt.availabilityHint || "Check local stores");
      return `
        <article class="alt-card">
          <div class="alt-top">
            <div class="alt-name-wrap">
              <h2>${name}</h2>
              <p>${whySafe}</p>
            </div>
            <div class="alt-meta">
              <span class="alt-price">${price}</span>
              <span class="alt-rating"><span class="star">★</span>${rating}</span>
            </div>
          </div>
          <div class="alt-safe">
            <span class="safe-check">✓</span>
            Compatible with your saved dietary profile
          </div>
          <div class="alt-tags">${tagsHtml || '<span class="pill safe">Profile-friendly</span>'}</div>
          <div class="alt-footer">
            <span class="alt-stock">${availability}</span>
          </div>
        </article>
      `;
    }).join("");
  }

  async function render() {
    const source = findScanSource();

    if (!source) {
      originalCard.hidden = true;
      alternativesList.hidden = true;
      emptyState.hidden = false;
      return;
    }

    originalCard.hidden = false;
    alternativesList.hidden = false;
    emptyState.hidden = true;

    originalName.textContent = source.productName || "Scanned Product";
    originalNote.textContent =
      source.note || `Flagged as ${source.status || "unsafe"} by your last scan.`;

    alternativesList.innerHTML = `
      <div class="empty-state" id="altsLoading">
        <div class="empty-icon">✨</div>
        <h3>Finding safe alternatives...</h3>
        <p>AI is analyzing your scanned product and profile preferences.</p>
      </div>
    `;

    try {
      const alternatives = await fetchSafeAlternatives(source);
      renderAlternatives(alternatives);
    } catch (err) {
      alternativesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Could not load AI alternatives</h3>
          <p>${escapeHtml((err && err.message) || "Please check your API key and try again.")}</p>
        </div>
      `;
    }
  }

  await render();
})();
