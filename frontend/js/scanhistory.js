// Scan History page — renders every scan in the current user's history.

(async function initScanHistory() {
  "use strict";

  await profileStorage.ready();

  if (!profileStorage.getCurrentUser()) {
    window.location.href = "LoginPage.html";
    return;
  }

  const searchInput = document.getElementById("searchInput");
  const historyList = document.getElementById("historyList");
  const emptyState = document.getElementById("emptyState");
  const statSafe = document.getElementById("statSafe");
  const statUnsafe = document.getElementById("statUnsafe");
  const statCaution = document.getElementById("statCaution");
  const statTiles = document.querySelectorAll(".stat[data-filter]");
  const compareBar = document.getElementById("compareBar");
  const compareBtn = document.getElementById("compareBtn");
  const compareModal = document.getElementById("compareModal");
  const compareModalBackdrop = document.getElementById("compareModalBackdrop");
  const compareCloseBtn = document.getElementById("compareCloseBtn");
  const sameIngredientsBox = document.getElementById("sameIngredientsBox");
  const differentIngredientsBox = document.getElementById("differentIngredientsBox");

  let activeStatusFilter = null;
  const selectedScanIds = new Set();

  function getScans() {
    return profileStorage.getCurrentScans();
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function iconFor(status) {
    if (status === "Unsafe") return "✕";
    if (status === "Caution") return "⚠";
    return "✓";
  }

  function renderCard(scan) {
    const statusClass = String(scan.status || "Safe").toLowerCase();
    const brand = (scan.brandName || "").trim();
    const category = (scan.category || "").trim();
    const thumb = typeof scan.thumbnail === "string" ? scan.thumbnail : "";
    const thumbHtml = thumb
      ? `<div class="history-thumb ${statusClass}">
           <img src="${escapeHtml(thumb)}" alt="" class="history-thumb-img" />
         </div>`
      : `<div class="history-icon ${statusClass}">${iconFor(scan.status)}</div>`;

    const brandHtml = brand
      ? `<div class="history-brand">${escapeHtml(brand)}</div>`
      : "";

    const categoryHtml = category
      ? `<span>•</span><span>${escapeHtml(category)}</span>`
      : "";

    return `
      <article class="history-card" data-id="${escapeHtml(scan.id)}">
        ${thumbHtml}
        <div class="history-main">
          <div class="history-title">${escapeHtml(scan.productName)}</div>
          ${brandHtml}
          <div class="history-meta">
            <span class="status-pill ${statusClass}">${escapeHtml(scan.status || "Safe")}</span>
            ${categoryHtml}
            <span>•</span>
            <span>${formatRelativeTime(scan.timestamp)}</span>
          </div>
        </div>
        <div class="history-select">
          <button type="button"
                  class="scan-select-btn ${selectedScanIds.has(scan.id) ? "is-selected" : ""}"
                  data-select-id="${escapeHtml(scan.id)}"
                  aria-label="Select scan ${escapeHtml(scan.productName || "Scanned Product")} for comparison"
                  aria-pressed="${selectedScanIds.has(scan.id) ? "true" : "false"}">✓</button>
        </div>
      </article>
    `;
  }

  function renderIngredientChips(items) {
    if (!items.length) return `<p class="compare-empty">None detected</p>`;
    return items.map((item) => `<span class="compare-chip">${escapeHtml(item)}</span>`).join("");
  }

  function renderProductGroups(groups) {
    if (!groups.length) return `<p class="compare-empty">No scans selected</p>`;
    return groups
      .map(
        (group) => `
          <div class="compare-product-group">
            <h4 class="compare-product-name">${escapeHtml(group.name)}</h4>
            <div class="compare-product-chips">${renderIngredientChips(group.items)}</div>
          </div>
        `
      )
      .join("");
  }

  // Pull a clean, deduplicated ingredient list out of OCR text. Designed so
  // the same ingredient written slightly differently across products still
  // collapses to one canonical form: "Salt (Sea Salt)" → both "salt" and
  // "sea salt"; "and salt" → "salt"; "less than 2% of: X" → just "X".
  function parseIngredientsFromOcr(ocrText) {
    if (!ocrText) return [];

    let source = String(ocrText).replace(/\r/g, " ");

    const match =
      source.match(/ingredients?\s*[:\-]\s*([\s\S]*)/i) ||
      source.match(/ingredients?\s+([\s\S]*)/i);
    if (match && match[1]) source = match[1];

    source = source.split(
      /\n\s*(allergy\s+information|allergen|distributed by|manufactured by|nutrition facts|warning|directions|storage|keep refrigerated)\b/i
    )[0];

    // Surface bracketed sub-ingredients as siblings of the parent so both
    // get matched across products. "salt (sea salt)" → "salt, sea salt".
    source = source.replace(/\(([^)]*)\)/g, (_, inner) => `, ${inner}`);

    // Drop "contains less than X% of:" / "X% or less of:" qualifier headers
    // so only the actual ingredient names that follow survive into the list.
    source = source.replace(
      /(?:contains\s+)?(?:less\s+than\s+\d+\s*%?|\d+\s*%\s+or\s+less)\s*(?:of\s+)?[:\-]?/gi,
      " "
    );

    const LEADING_FILLER = /^(?:and|or|with|of|from|the|a|an|plus|including)\s+/i;
    const seen = new Set();

    return source
      .split(/[,;•\n]+/)
      .flatMap((chunk) =>
        chunk
          .toLowerCase()
          .replace(/&/g, " and ")
          .split(/\s+(?:and\s*\/\s*or|and|or)\s+/i)
      )
      .map((x) => {
        let s = x
          .replace(/[^a-z0-9\s\-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        let prev;
        do {
          prev = s;
          s = s
            .replace(LEADING_FILLER, "")
            .replace(/^\d+\s*(?:%|percent)?\s*/i, "")
            .trim();
        } while (s !== prev);
        return s;
      })
      .filter((x) => x && x.length >= 2 && x.length <= 60)
      .filter((x) => {
        if (seen.has(x)) return false;
        seen.add(x);
        return true;
      })
      .slice(0, 200);
  }

  function openCompareModal() {
    const scans = getScans().filter((s) => selectedScanIds.has(s.id));
    if (scans.length < 2) return;

    const products = scans.map((scan) => ({
      name: scan.productName || "Untitled scan",
      ingredients: parseIngredientsFromOcr(scan.ocrText),
    }));

    const ingredientSets = products.map((p) => new Set(p.ingredients));

    const sameSet = new Set(
      products[0].ingredients.filter((ing) =>
        ingredientSets.every((set) => set.has(ing))
      )
    );

    const sameByProduct = products.map((p) => ({
      name: p.name,
      items: p.ingredients.filter((ing) => sameSet.has(ing)),
    }));

    const differentByProduct = products.map((p) => ({
      name: p.name,
      items: p.ingredients.filter((ing) => !sameSet.has(ing)),
    }));

    sameIngredientsBox.innerHTML = renderProductGroups(sameByProduct);
    differentIngredientsBox.innerHTML = renderProductGroups(differentByProduct);
    compareModal.hidden = false;
  }

  function closeCompareModal() {
    compareModal.hidden = true;
  }

  function syncCompareBar() {
    const count = selectedScanIds.size;
    compareBar.hidden = count < 2;
    if (compareBtn) {
      compareBtn.textContent = `Compare Scans (${count})`;
    }
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const allScans = getScans();

    const counts = allScans.reduce(
      (acc, scan) => {
        const key = (scan.status || "Safe").toLowerCase();
        if (key in acc) acc[key] += 1;
        return acc;
      },
      { safe: 0, unsafe: 0, caution: 0 }
    );
    statSafe.textContent = String(counts.safe);
    statUnsafe.textContent = String(counts.unsafe);
    statCaution.textContent = String(counts.caution);

    statTiles.forEach((tile) => {
      const on = tile.dataset.filter === activeStatusFilter;
      tile.classList.toggle("is-active", on);
      tile.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const statusFiltered = activeStatusFilter
      ? allScans.filter((scan) => String(scan.status || "Safe").toLowerCase() === activeStatusFilter)
      : allScans;

    const matching = query
      ? statusFiltered.filter((scan) =>
          [scan.productName, scan.brandName, scan.category, scan.status]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(query))
        )
      : statusFiltered;

    if (allScans.length === 0) {
      emptyState.hidden = false;
      historyList.hidden = true;
      historyList.innerHTML = "";
      return;
    }

    emptyState.hidden = true;
    historyList.hidden = false;

    if (matching.length === 0) {
      let message;
      if (query && activeStatusFilter) {
        message = `No ${activeStatusFilter} scans match "${escapeHtml(searchInput.value)}".`;
      } else if (query) {
        message = `No matches for "${escapeHtml(searchInput.value)}".`;
      } else {
        message = `No ${activeStatusFilter} scans yet.`;
      }
      historyList.innerHTML = `<p style="color:#6A7282;font-size:14px;margin:0;">${message}</p>`;
      return;
    }

    historyList.innerHTML = matching.map(renderCard).join("");
    syncCompareBar();
  }

  searchInput.addEventListener("input", render);

  function toggleFilter(filter) {
    activeStatusFilter = activeStatusFilter === filter ? null : filter;
    render();
  }

  statTiles.forEach((tile) => {
    tile.addEventListener("click", () => toggleFilter(tile.dataset.filter));
    tile.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleFilter(tile.dataset.filter);
      }
    });
  });

  historyList.addEventListener("click", (event) => {
    const selectBtn = event.target.closest(".scan-select-btn");
    if (selectBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = selectBtn.dataset.selectId;
      if (!id) return;
      if (selectedScanIds.has(id)) {
        selectedScanIds.delete(id);
      } else {
        if (selectedScanIds.size >= 3) {
          alert("You can compare a maximum of 3 scans.");
          return;
        }
        selectedScanIds.add(id);
      }
      render();
      return;
    }

    const card = event.target.closest(".history-card");
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    const scan = getScans().find((s) => s.id === id);
    if (!scan) return;

    if (!scan.ocrText) {
      alert("This scan was saved before the revisit feature existed. Re-scan to see the full results.");
      return;
    }

    sessionStorage.setItem("ocrText", scan.ocrText);
    sessionStorage.setItem("revisitScanId", scan.id);
    sessionStorage.setItem("revisitProductName", scan.productName || "");
    sessionStorage.setItem("revisitOrigin", "ScanHistoryPage.html");
    sessionStorage.removeItem("croppedImage");
    sessionStorage.removeItem("capturedImage");
    window.location.href = "ResultsPage.html";
  });

  if (compareBtn) {
    compareBtn.addEventListener("click", () => {
      if (selectedScanIds.size < 2) {
        alert("Please select at least 2 scans to compare.");
        return;
      }
      openCompareModal();
    });
  }

  if (compareModalBackdrop) {
    compareModalBackdrop.addEventListener("click", closeCompareModal);
  }
  if (compareCloseBtn) {
    compareCloseBtn.addEventListener("click", closeCompareModal);
  }

  render();
})();
