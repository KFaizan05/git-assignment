// Safe Items page — shows every scan in the current user's history that
// came back Safe. No hardcoded products: if the user has scanned nothing,
// we show an empty state inviting them to scan.
//
// Data source: profileStorage.getCurrentScans() (per-user, isolated).

(function initSafeItems() {
  "use strict";

  // Redirect to Login if no one is signed in.
  if (!profileStorage.getCurrentUser()) {
    window.location.href = "LoginPage.html";
    return;
  }

  const backBtn = document.getElementById("backBtn");
  const searchInput = document.getElementById("searchInput");
  const safeList = document.getElementById("safeList");
  const emptyState = document.getElementById("emptyState");
  const statTotal = document.getElementById("statTotal");
  const statFavorites = document.getElementById("statFavorites");
  const statCategories = document.getElementById("statCategories");

  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "DashboardPage.html";
    }
  });

  // Only Safe scans make it into this view.
  function getSafeScans() {
    return profileStorage
      .getCurrentScans()
      .filter((scan) => scan.status === "Safe");
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

  function renderCard(scan) {
    const brand = scan.brandName ? escapeHtml(scan.brandName) : "Unknown brand";
    const category = scan.category ? escapeHtml(scan.category) : "Uncategorized";
    const note = scan.note ? `<p class="safe-card-note">"${escapeHtml(scan.note)}"</p>` : "";
    const favoriteMarker = scan.savedToSafe === false ? "" : "";

    // Use the actual scan photo when we have one; otherwise show the
    // original ✓ tile so older scans keep rendering.
    const thumb = typeof scan.thumbnail === "string" ? scan.thumbnail : "";
    const iconHtml = thumb
      ? `<div class="safe-card-icon safe-card-thumb">
           <img src="${escapeHtml(thumb)}" alt="" class="safe-card-thumb-img" />
         </div>`
      : `<div class="safe-card-icon">✓</div>`;

    return `
      <article class="safe-card" data-id="${escapeHtml(scan.id)}">
        <div class="safe-card-top">
          ${iconHtml}
          <div class="safe-card-main">
            <div class="safe-card-title">${escapeHtml(scan.productName)} ${favoriteMarker}</div>
            <div class="safe-card-brand">${brand}</div>
            <div class="safe-card-meta">
              <span class="chip">${category}</span>
              <span>•</span>
              <span>${formatRelativeTime(scan.timestamp)}</span>
            </div>
            ${note}
          </div>
        </div>
        <div class="safe-card-actions">
          <button class="action-btn action-view" type="button" data-action="view">View Details</button>
          <button class="action-btn action-similar" type="button" data-action="similar">Find Similar</button>
        </div>
      </article>
    `;
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const allSafe = getSafeScans();
    const matching = query
      ? allSafe.filter((scan) =>
          [scan.productName, scan.brandName, scan.category]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(query))
        )
      : allSafe;

    // Stats always reflect total safe items, not the filtered view.
    const categories = new Set(
      allSafe.map((scan) => (scan.category || "").trim()).filter(Boolean)
    );
    const favorites = allSafe.filter((scan) => scan.savedToSafe).length;
    statTotal.textContent = String(allSafe.length);
    statFavorites.textContent = String(favorites);
    statCategories.textContent = String(categories.size);

    if (allSafe.length === 0) {
      emptyState.hidden = false;
      safeList.hidden = true;
      safeList.innerHTML = "";
      return;
    }

    emptyState.hidden = true;
    safeList.hidden = false;

    if (matching.length === 0) {
      safeList.innerHTML = `<p class="empty-state-inline" style="color:#6A7282;font-size:14px;">No matches for "${escapeHtml(searchInput.value)}".</p>`;
      return;
    }

    safeList.innerHTML = matching.map(renderCard).join("");
  }

  searchInput.addEventListener("input", render);

  // Card action buttons (event delegation).
  safeList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "similar") {
      window.location.href = "AlternativesPage.html";
    } else if (action === "view") {
      // Future: navigate to a detail page. For now, no-op.
    }
  });

  render();
})();
