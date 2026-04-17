// Scan History page — renders every scan in the current user's history.
// No hardcoded products. If nothing has been scanned yet, we show an empty
// state pointing the user at the Scan page.

(function initScanHistory() {
  "use strict";

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
    const brand = scan.brandName || "Unknown brand";
    const category = scan.category || "Uncategorized";

    return `
      <article class="history-card" data-id="${escapeHtml(scan.id)}">
        <div class="history-icon ${statusClass}">${iconFor(scan.status)}</div>
        <div class="history-main">
          <div class="history-title">${escapeHtml(scan.productName)}</div>
          <div class="history-brand">${escapeHtml(brand)}</div>
          <div class="history-meta">
            <span class="status-pill ${statusClass}">${escapeHtml(scan.status || "Safe")}</span>
            <span>•</span>
            <span>${escapeHtml(category)}</span>
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

    const matching = query
      ? allScans.filter((scan) =>
          [scan.productName, scan.brandName, scan.category, scan.status]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(query))
        )
      : allScans;

    if (allScans.length === 0) {
      emptyState.hidden = false;
      historyList.hidden = true;
      historyList.innerHTML = "";
      return;
    }

    emptyState.hidden = true;
    historyList.hidden = false;

    if (matching.length === 0) {
      historyList.innerHTML = `<p style="color:#6A7282;font-size:14px;margin:0;">No matches for "${escapeHtml(searchInput.value)}".</p>`;
      return;
    }

    historyList.innerHTML = matching.map(renderCard).join("");
  }

  searchInput.addEventListener("input", render);

  render();
})();
