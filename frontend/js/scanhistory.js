// Scan History page — renders every scan in the current user's history.

(async function initScanHistory() {
  "use strict";

  // Hydrate the client cache from the server before any sync getter.
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

  // Active status filter: null = show everything, otherwise the lowercase
  // status string ("safe" | "unsafe" | "caution"). Clicking the matching
  // stat tile toggles the filter on and off.
  let activeStatusFilter = null;

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
    // Brand is optional now — we only render the brand line if the user
    // actually set one. The old "Unknown brand" fallback was noise.
    const brand = (scan.brandName || "").trim();
    // Category is optional too. When it's blank we omit the span and its
    // separator so the meta row doesn't end up with back-to-back bullets.
    const category = (scan.category || "").trim();

    // Prefer an actual image preview of the scanned/uploaded photo; fall
    // back to the status icon tile when there's no thumbnail (older scans
    // saved before thumbnails existed, or manual-paste scans).
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
      </article>
    `;
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const allScans = getScans();

    // Stat tiles always show the TOTAL counts across the full history, not
    // the filtered view — the filter only narrows the list below.
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

    // Sync the visual active-state of each stat tile with the current filter.
    statTiles.forEach((tile) => {
      const on = tile.dataset.filter === activeStatusFilter;
      tile.classList.toggle("is-active", on);
      tile.setAttribute("aria-pressed", on ? "true" : "false");
    });

    // Compose status filter + search filter. Both are optional.
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
      // Tailor the empty message so users understand whether it's the search
      // query or the status filter that's hiding everything.
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
  }

  searchInput.addEventListener("input", render);

  // Click (or keyboard-activate) a stat tile to toggle the matching status
  // filter. Clicking the same tile again clears the filter and restores the
  // full list.
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

  // Click a history card → open ResultsPage with that scan's stored OCR
  // text + saved product name. results.js detects the revisit via the
  // `revisitScanId` session key and skips re-saving a duplicate record.
  historyList.addEventListener("click", (event) => {
    const card = event.target.closest(".history-card");
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    const scan = getScans().find((s) => s.id === id);
    if (!scan) return;

    // If the scan was saved before we started persisting OCR text, there's
    // nothing to replay — let the user know instead of silently opening an
    // empty Results page.
    if (!scan.ocrText) {
      alert("This scan was saved before the revisit feature existed. Re-scan to see the full results.");
      return;
    }

    sessionStorage.setItem("ocrText", scan.ocrText);
    sessionStorage.setItem("revisitScanId", scan.id);
    sessionStorage.setItem("revisitProductName", scan.productName || "");
    // Remember that this scan was opened from Scan History so the Results
    // page's back button returns the user here instead of falling back to
    // whatever page happens to be on top of the history stack.
    sessionStorage.setItem("revisitOrigin", "ScanHistoryPage.html");
    // Clear any lingering image so we don't show a stale photo from the
    // previous fresh scan; revisit mode has no cropped image to display.
    sessionStorage.removeItem("croppedImage");
    sessionStorage.removeItem("capturedImage");
    window.location.href = "ResultsPage.html";
  });

  render();
})();
