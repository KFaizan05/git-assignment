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
  const statTiles = document.querySelectorAll(".stat[data-filter]");

  // Active subset filter: null shows every Safe scan, "favorites" narrows
  // the list to ones the user has starred. Toggling the tile flips it back.
  let activeFilter = null;

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
    // Brand is optional now — only render the row if the user set one.
    // The "Unknown brand" fallback was noise on every untitled scan.
    const brand = (scan.brandName || "").trim();
    const brandHtml = brand ? `<div class="safe-card-brand">${escapeHtml(brand)}</div>` : "";
    // Category is optional too — omit the chip entirely when empty
    // instead of showing an "Uncategorized" placeholder.
    const category = (scan.category || "").trim();
    const categoryChipHtml = category
      ? `<span class="chip">${escapeHtml(category)}</span><span>•</span>`
      : "";
    const note = scan.note ? `<p class="safe-card-note">"${escapeHtml(scan.note)}"</p>` : "";

    // Favorite star — filled + gold when savedToSafe is true, empty outline
    // otherwise. Users toggle per-item; the old auto-favorite-on-scan behavior
    // was removed. The SVG is shared between states; CSS swaps fill/stroke.
    const isFav = !!scan.savedToSafe;
    const favLabel = isFav ? "Unfavorite" : "Favorite";
    const favBtnHtml = `
      <button
        type="button"
        class="safe-card-fav ${isFav ? "is-fav" : ""}"
        data-action="fav"
        aria-pressed="${isFav}"
        aria-label="${favLabel} ${escapeHtml(scan.productName)}"
        title="${favLabel}"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" class="star-svg" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>
    `;

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
            <div class="safe-card-title">
              <span class="safe-card-title-text">${escapeHtml(scan.productName)}</span>
              ${favBtnHtml}
            </div>
            ${brandHtml}
            <div class="safe-card-meta">
              ${categoryChipHtml}
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

    // Apply the Favorites filter first, then the search query on top. Stats
    // still count the full Safe list so users can see the totals regardless
    // of what's currently showing.
    const filtered = activeFilter === "favorites"
      ? allSafe.filter((scan) => !!scan.savedToSafe)
      : allSafe;

    const matching = query
      ? filtered.filter((scan) =>
          [scan.productName, scan.brandName, scan.category]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(query))
        )
      : filtered;

    // Stats always reflect total safe items, not the filtered view.
    const categories = new Set(
      allSafe.map((scan) => (scan.category || "").trim()).filter(Boolean)
    );
    const favorites = allSafe.filter((scan) => scan.savedToSafe).length;
    statTotal.textContent = String(allSafe.length);
    statFavorites.textContent = String(favorites);
    statCategories.textContent = String(categories.size);

    // Reflect the active filter on the stat tile.
    statTiles.forEach((tile) => {
      const on = tile.dataset.filter === activeFilter;
      tile.classList.toggle("is-active", on);
      tile.setAttribute("aria-pressed", on ? "true" : "false");
    });

    if (allSafe.length === 0) {
      emptyState.hidden = false;
      safeList.hidden = true;
      safeList.innerHTML = "";
      return;
    }

    emptyState.hidden = true;
    safeList.hidden = false;

    if (matching.length === 0) {
      // Compose a helpful empty message depending on which filters are on.
      let message;
      if (query && activeFilter === "favorites") {
        message = `No favorites match "${escapeHtml(searchInput.value)}".`;
      } else if (query) {
        message = `No matches for "${escapeHtml(searchInput.value)}".`;
      } else if (activeFilter === "favorites") {
        message = "No favorites yet — tap the star on a safe item to save it here.";
      } else {
        message = "No safe items to show.";
      }
      safeList.innerHTML = `<p class="empty-state-inline" style="color:#6A7282;font-size:14px;">${message}</p>`;
      return;
    }

    safeList.innerHTML = matching.map(renderCard).join("");
  }

  searchInput.addEventListener("input", render);

  // Click (or keyboard-activate) the Favorites tile to toggle the filter
  // on/off. Other stat tiles have no data-filter so they aren't wired up.
  function toggleFilter(filter) {
    activeFilter = activeFilter === filter ? null : filter;
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

  // Card action buttons (event delegation) — "View Details" revisits the
  // exact Results page for this scan by replaying its stored OCR text.
  // The star button toggles the scan's savedToSafe flag and re-renders so
  // the Favorites counter updates.
  safeList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    const card = event.target.closest(".safe-card");
    if (!btn || !card) return;
    const action = btn.dataset.action;
    const id = card.dataset.id;

    if (action === "fav" && id) {
      const scan = getSafeScans().find((s) => s.id === id);
      if (!scan) return;
      profileStorage.updateCurrentScan(id, { savedToSafe: !scan.savedToSafe });
      render();
      return;
    }

    if (action === "similar") {
      window.location.href = "AlternativesPage.html";
      return;
    }

    if (action === "view" && id) {
      const scan = getSafeScans().find((s) => s.id === id);
      if (!scan) return;
      if (!scan.ocrText) {
        alert("This scan was saved before the revisit feature existed. Re-scan to see the full results.");
        return;
      }
      sessionStorage.setItem("ocrText", scan.ocrText);
      sessionStorage.setItem("revisitScanId", scan.id);
      sessionStorage.setItem("revisitProductName", scan.productName || "");
      sessionStorage.removeItem("croppedImage");
      sessionStorage.removeItem("capturedImage");
      window.location.href = "ResultsPage.html";
    }
  });

  render();
})();
