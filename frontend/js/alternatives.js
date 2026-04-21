// Alternatives page — shows placeholder suggestions based on the user's most
// recent scan. Real product recommendations aren't wired up yet, so if there's
// nothing to base a suggestion on we just show an empty state.

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

  // Pick the most recent scan that wasn't Safe — those are the ones the user
  // would want alternatives for.
  function findLastProblematicScan() {
    if (!profileStorage.getCurrentUser()) return null;
    const scans = profileStorage.getCurrentScans();
    return scans.find((scan) => scan.status && scan.status !== "Safe") || null;
  }

  function render() {
    const source = findLastProblematicScan();

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

    // Real recommendation engine isn't built yet — show an honest placeholder
    // instead of made-up products. This keeps the page buildable and truthful.
    alternativesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        <h3>Smart suggestions coming soon</h3>
        <p>We'll recommend safe swaps tailored to your profile and this product once the alternatives engine is ready.</p>
      </div>
    `;
  }

  render();
})();
