// AI Chef page — renders profile pills from the signed-in user's profile
// (dietary as safe-pills, allergens as danger-pills) and surfaces a set of
// suggested prompts. Tapping a prompt or using the chat composer routes the
// user to the RecipeGenerationPage with the selected prompt stored in
// sessionStorage so we don't smuggle it through the URL.


(async function initAiChatbot() {
  "use strict";

  // Hydrate from the server before reading any cached getter.
  await profileStorage.ready();

  const welcomeTitle = document.getElementById("welcomeTitle");
  const profilePills = document.getElementById("profilePills");
  const promptGrid = document.getElementById("promptGrid");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");

  const PROMPT_STORAGE_KEY = "labelwiseChefPrompt";

  // UI preset prompts — these are suggestion templates, not user-specific
  // data. They help the user get started when they haven't typed anything.
  const PRESET_PROMPTS = [
    {
      icon: "🥗",
      title: "Quick dinner idea",
      desc: "Something easy for tonight"
    },
    {
      icon: "🍳",
      title: "Breakfast recipe",
      desc: "Start my day with something safe"
    },
    {
      icon: "🍪",
      title: "Healthy snack",
      desc: "A snack that fits my profile"
    },
    {
      icon: "🥘",
      title: "Use what I have",
      desc: "Turn my safe items into a meal"
    },
    {
      icon: "🍲",
      title: "Comfort food",
      desc: "Cozy meals that work for me"
    },
    {
      icon: "🥑",
      title: "Meal prep ideas",
      desc: "Batch-friendly recipes for the week"
    }
  ];

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderWelcome() {
    const profile = profileStorage.getCurrentProfile();
    if (profile && profile.name) {
      welcomeTitle.textContent = `Welcome, ${profile.name}!`;
    } else {
      welcomeTitle.textContent = "Welcome to AI Chef!";
    }
  }

  function renderProfilePills() {
    const profile = profileStorage.getCurrentProfile();
    const dietary = Array.isArray(profile.dietary) ? profile.dietary : [];
    const allergens = Array.isArray(profile.allergens) ? profile.allergens : [];
    const customAllergens = Array.isArray(profile.customAllergens) ? profile.customAllergens : [];

    if (dietary.length === 0 && allergens.length === 0 && customAllergens.length === 0) {
      profilePills.innerHTML = `<p class="empty-note">No dietary preferences set yet. Update your profile to get personalized recipes.</p>`;
      return;
    }

    const safePills = dietary.map((d) => `<span class="pill safe">${escapeHtml(d)}</span>`);
    const dangerPills = allergens.map((a) => `<span class="pill danger">No ${escapeHtml(a)}</span>`);
    const customPills = customAllergens.map((a) => `<span class="pill danger">No ${escapeHtml(a)}</span>`);
    profilePills.innerHTML = safePills.concat(dangerPills, customPills).join("");
  }

  function renderPromptGrid() {
    promptGrid.innerHTML = PRESET_PROMPTS.map(
      (p) => `
        <button type="button" class="prompt-card" data-prompt="${escapeHtml(p.title)}">
          <span class="prompt-icon">${escapeHtml(p.icon)}</span>
          <span class="prompt-title">${escapeHtml(p.title)}</span>
          <span class="prompt-desc">${escapeHtml(p.desc)}</span>
        </button>
      `
    ).join("");
  }

  function submitPrompt(prompt) {
    const clean = String(prompt || "").trim();
    if (!clean) return;
    try {
      sessionStorage.setItem(PROMPT_STORAGE_KEY, clean);
    } catch (err) {
      console.warn("aichatbot: could not persist prompt", err);
    }
    window.location.href = "RecipeGenerationPage.html";
  }

  promptGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".prompt-card");
    if (!card) return;
    submitPrompt(card.getAttribute("data-prompt"));
  });

  chatSendBtn.addEventListener("click", () => {
    submitPrompt(chatInput.value);
  });

  chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPrompt(chatInput.value);
    }
  });

  renderWelcome();
  renderProfilePills();
  renderPromptGrid();
})();
