// Dashboard page controller.
//
// Wrapped in an async IIFE so we can `await profileStorage.ready()` before
// rendering — otherwise the first paint shows "No scans yet" even for
// accounts that have a full history on the server.

(async function initDashboard() {
  "use strict";

  await profileStorage.ready();

  if (!profileStorage.getCurrentUser()) {
    window.location.replace("LoginPage.html");
    return;
  }

  const settingsBtn = document.getElementById("settingsBtn");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const dietaryProfileContainer = document.getElementById("dietaryProfileContainer");
  const recentScansContainer = document.getElementById("recentScansContainer");
  const welcomeTitle = document.getElementById("welcomeTitle");

  settingsBtn.addEventListener("click", () => {
    window.location.href = "SettingsPage.html";
  });

  editProfileBtn.addEventListener("click", () => {
    window.location.href = "EditProfilePage.html";
  });

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createTag(text, type = "default") {
    return `<span class="profile-tag ${type}">${escapeHtml(text)}</span>`;
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

  function renderDietaryProfile() {
    const profile = profileStorage.getCurrentProfile();
    const dietary = profile.dietary || [];
    const allergens = profile.allergens || [];
    const customAllergens = profile.customAllergens || [];

    welcomeTitle.textContent = profile.name && profile.name.trim()
      ? `Welcome back, ${profile.name.trim()}!`
      : "Welcome back!";

    const allTags = [
      ...dietary.map(item => createTag(item, "safe")),
      ...allergens.map(item => createTag(item, "danger")),
      ...customAllergens.map(item => createTag(item, "danger"))
    ];

    if (allTags.length === 0) {
      dietaryProfileContainer.innerHTML = `
        <div class="profile-tags">
          <span class="profile-muted">No profile selections yet</span>
        </div>
      `;
      return;
    }

    dietaryProfileContainer.innerHTML = `
      <div class="profile-tags">
        ${allTags.join("")}
      </div>
    `;
  }

  function renderRecentScans() {
    const scans = profileStorage.getCurrentScans().slice(0, 3);

    if (scans.length === 0) {
      recentScansContainer.innerHTML = `
        <div class="scan-empty">
          <p>No scans yet. Tap <strong>Scan Product</strong> to get started.</p>
        </div>
      `;
      return;
    }

    recentScansContainer.innerHTML = scans
      .map((scan) => {
        const status = String(scan.status || "Safe");
        const statusClass = status.toLowerCase();
        // Category is optional — omit it (and its leading bullet) when
        // empty so the meta row doesn't show a stray dot.
        const category = (scan.category || "").trim();
        // Prefer a real photo thumbnail; fall back to the status glyph so
        // older scans (saved before thumbnails existed) still render.
        const thumb = typeof scan.thumbnail === "string" ? scan.thumbnail : "";
        const leftTile = thumb
          ? `<div class="scan-status scan-thumb ${statusClass}">
               <img src="${escapeHtml(thumb)}" alt="" class="scan-thumb-img" />
             </div>`
          : `<div class="scan-status ${statusClass}">${status === "Unsafe" ? "✕" : status === "Caution" ? "⚠" : "✓"}</div>`;
        const categoryHtml = category
          ? `<span class="scan-meta-sep">•</span><span>${escapeHtml(category)}</span>`
          : "";
        // Colored status pill + (optional) category + relative time, matching
        // the Scan History page layout.
        return `
          <div class="scan-item" data-id="${escapeHtml(scan.id)}" role="button" tabindex="0">
            <div class="scan-item-left">
              ${leftTile}
              <div>
                <div class="scan-title">${escapeHtml(scan.productName)}</div>
                <div class="scan-meta">
                  <span class="status-pill ${statusClass}">${escapeHtml(status)}</span>
                  ${categoryHtml}
                  <span class="scan-meta-sep">•</span>
                  <span>${escapeHtml(formatRelativeTime(scan.timestamp))}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Click (or Enter/Space) on a recent scan tile → re-open that scan's
  // exact Results page. results.js picks up `revisitScanId` and replays
  // the stored OCR text without re-running OCR.
  function openScan(id) {
    if (!id) return;
    const scan = profileStorage.getCurrentScans().find((s) => s.id === id);
    if (!scan) return;
    if (!scan.ocrText) {
      alert("This scan was saved before the revisit feature existed. Re-scan to see the full results.");
      return;
    }
    sessionStorage.setItem("ocrText", scan.ocrText);
    sessionStorage.setItem("revisitScanId", scan.id);
    sessionStorage.setItem("revisitProductName", scan.productName || "");
    // Origin tag so the Results page back button can return the user to
    // *this* page — not whatever page they happened to be on before.
    sessionStorage.setItem("revisitOrigin", "DashboardPage.html");
    sessionStorage.removeItem("croppedImage");
    sessionStorage.removeItem("capturedImage");
    window.location.href = "ResultsPage.html";
  }

  recentScansContainer.addEventListener("click", (event) => {
    const item = event.target.closest(".scan-item");
    if (!item) return;
    openScan(item.dataset.id);
  });

  recentScansContainer.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest(".scan-item");
    if (!item) return;
    event.preventDefault();
    openScan(item.dataset.id);
  });

  renderDietaryProfile();
  renderRecentScans();
})();
