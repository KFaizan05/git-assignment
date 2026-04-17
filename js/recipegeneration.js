// Recipe Generation page — takes the prompt the user gave AI Chef (stored in
// sessionStorage under `labelwiseChefPrompt`) and shows an honest placeholder
// response. A real LLM-backed generator isn't wired up yet, so we don't
// fabricate a recipe — we echo the user's prompt, confirm which of their
// profile constraints we'd honor, and explain that generation is coming soon.
//
// No hardcoded recipes. Re-submitting from the composer just updates the
// user bubble and re-runs the placeholder flow with the new prompt.

(function initRecipeGeneration() {
  "use strict";

  const backBtn = document.getElementById("backBtn");
  const userMessageBlock = document.getElementById("userMessageBlock");
  const userPromptEl = document.getElementById("userPrompt");
  const aiIntro = document.getElementById("aiIntro");
  const emptyState = document.getElementById("emptyState");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const recipeContent = document.getElementById("recipeContent");

  const PROMPT_STORAGE_KEY = "labelwiseChefPrompt";

  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "AIChatbotPage.html";
    }
  });

  function buildProfileSummary() {
    const profile = profileStorage.getCurrentProfile();
    const dietary = Array.isArray(profile.dietary) ? profile.dietary : [];
    const allergens = Array.isArray(profile.allergens) ? profile.allergens : [];

    const parts = [];
    if (dietary.length) parts.push(`dietary preferences: ${dietary.join(", ")}`);
    if (allergens.length) parts.push(`avoiding: ${allergens.join(", ")}`);
    return parts.length ? parts.join(" • ") : "No dietary preferences set.";
  }

  function showPromptResponse(prompt) {
    const clean = String(prompt || "").trim();

    if (!clean) {
      userMessageBlock.hidden = true;
      aiIntro.textContent = "Tell me what you're in the mood for and I'll build a recipe that matches your profile.";
      emptyState.hidden = false;
      return;
    }

    userPromptEl.textContent = clean;
    userMessageBlock.hidden = false;
    emptyState.hidden = true;

    const summary = buildProfileSummary();
    aiIntro.innerHTML = `
      Got it — <strong>"${escapeHtml(clean)}"</strong>.<br>
      I'll tailor recipes around your profile (${escapeHtml(summary)}).
    `;

    // Add a placeholder note after the intro so we don't fake a recipe.
    const existingNote = document.getElementById("placeholderNote");
    if (existingNote) existingNote.remove();

    const note = document.createElement("div");
    note.className = "empty-state";
    note.id = "placeholderNote";
    note.innerHTML = `
      <div class="empty-icon">✨</div>
      <h3>Recipe generation coming soon</h3>
      <p>Once the recipe engine is wired up, your prompt will be turned into a full recipe that respects your dietary needs. Thanks for your patience!</p>
    `;
    const bubbleWrap = document.querySelector(".ai-bubble-wrap");
    if (bubbleWrap) bubbleWrap.appendChild(note);
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function submitFromComposer() {
    const value = chatInput.value.trim();
    if (!value) return;
    try {
      sessionStorage.setItem(PROMPT_STORAGE_KEY, value);
    } catch (err) {
      console.warn("recipegeneration: could not persist prompt", err);
    }
    showPromptResponse(value);
    chatInput.value = "";
    // Scroll to bottom so the newest content is visible.
    recipeContent.scrollTop = recipeContent.scrollHeight;
  }

  chatSendBtn.addEventListener("click", submitFromComposer);
  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitFromComposer();
    }
  });

  // On load, pull the prompt from sessionStorage and render a response.
  let initialPrompt = "";
  try {
    initialPrompt = sessionStorage.getItem(PROMPT_STORAGE_KEY) || "";
  } catch (err) {
    initialPrompt = "";
  }
  showPromptResponse(initialPrompt);
})();
