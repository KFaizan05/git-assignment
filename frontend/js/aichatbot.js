// AI Chef page — renders profile pills from the signed-in user's profile
// (dietary as safe-pills, allergens as danger-pills) and surfaces either:
//   - a "Recent Chats" list when the user has previously started any chats,
//     so they can re-open one (e.g. after accidentally exiting the page); OR
//   - the preset "Try asking me..." prompt grid when there are no chats yet.
// Tapping a prompt or using the chat composer routes the user to
// RecipeGenerationPage with the selected prompt stored in sessionStorage.

(async function initAiChatbot() {
  "use strict";

  await profileStorage.ready();

  const welcomeTitle = document.getElementById("welcomeTitle");
  const profilePills = document.getElementById("profilePills");
  const promptGrid = document.getElementById("promptGrid");
  const promptSection = document.getElementById("promptSection");
  const promptSectionTitle = document.getElementById("promptSectionTitle");
  const recentsList = document.getElementById("recentsList");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");

  const PROMPT_STORAGE_KEY = "labelwiseChefPrompt";
  const REVISIT_CHAT_KEY = "labelwiseChefRevisitChatId";

  // UI preset prompts — these are suggestion templates, not user-specific
  // data. They help the user get started when they haven't typed anything
  // and have no recent chats yet.
  const PRESET_PROMPTS = [
    { icon: "🥗", title: "Quick dinner idea",  desc: "Something easy for tonight" },
    { icon: "🍳", title: "Breakfast recipe",   desc: "Start my day with something safe" },
    { icon: "🍪", title: "Healthy snack",      desc: "A snack that fits my profile" },
    { icon: "🥘", title: "Use what I have",    desc: "Turn my safe items into a meal" },
    { icon: "🍲", title: "Comfort food",       desc: "Cozy meals that work for me" },
    { icon: "🥑", title: "Meal prep ideas",    desc: "Batch-friendly recipes for the week" }
  ];

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks} wk${weeks === 1 ? "" : "s"} ago`;
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

  function renderRecentsList(chats) {
    recentsList.innerHTML = chats
      .map(
        (chat) => `
          <button type="button" class="recent-chat-card" data-chat-id="${escapeHtml(chat.id)}">
            <div class="recent-chat-row">
              <span class="recent-chat-icon">💬</span>
              <span class="recent-chat-title">${escapeHtml(chat.title)}</span>
              <button type="button"
                      class="recent-chat-delete"
                      data-delete-id="${escapeHtml(chat.id)}"
                      aria-label="Delete recent chat ${escapeHtml(chat.title)}">×</button>
            </div>
            <div class="recent-chat-meta">${escapeHtml(formatRelativeTime(chat.timestamp))}</div>
          </button>
        `
      )
      .join("");
  }

  // Decide whether to show the preset prompt grid or the recent-chats list.
  // Recents take priority once the user has started at least one chat —
  // the preset grid is for first-time users who have nothing to revisit.
  function renderPromptSection() {
    const chats = profileStorage.getCurrentChats();
    if (chats.length > 0) {
      promptSectionTitle.textContent = "Recent Chats";
      promptGrid.hidden = true;
      recentsList.hidden = false;
      renderRecentsList(chats);
    } else {
      promptSectionTitle.textContent = "Try asking me...";
      promptGrid.hidden = false;
      recentsList.hidden = true;
      renderPromptGrid();
    }
  }

  function submitPrompt(prompt) {
    const clean = String(prompt || "").trim();
    if (!clean) return;
    try {
      sessionStorage.setItem(PROMPT_STORAGE_KEY, clean);
      // Fresh chat — make sure no stale revisit id is left over from a
      // previous tap on a recents tile.
      sessionStorage.removeItem(REVISIT_CHAT_KEY);
    } catch (err) {
      console.warn("aichatbot: could not persist prompt", err);
    }
    window.location.href = "RecipeGenerationPage.html";
  }

  function openChat(chatId) {
    if (!chatId) return;
    try {
      sessionStorage.setItem(REVISIT_CHAT_KEY, String(chatId));
      // Clear any pending fresh prompt so RecipeGenerationPage knows this
      // is a revisit, not a new ask.
      sessionStorage.removeItem(PROMPT_STORAGE_KEY);
    } catch (err) {
      console.warn("aichatbot: could not persist revisit id", err);
    }
    window.location.href = "RecipeGenerationPage.html";
  }

  async function deleteChat(chatId) {
    if (!chatId) return;
    try {
      await profileStorage.deleteCurrentChat(chatId);
      renderPromptSection();
    } catch (err) {
      console.warn("aichatbot: could not delete chat", err);
      alert("Could not delete that chat. Please try again.");
    }
  }

  promptGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".prompt-card");
    if (!card) return;
    submitPrompt(card.getAttribute("data-prompt"));
  });

  recentsList.addEventListener("click", (event) => {
    // Delete button takes priority over the surrounding open-chat tile so
    // tapping the × doesn't accidentally re-open the chat we're removing.
    const delBtn = event.target.closest(".recent-chat-delete");
    if (delBtn) {
      event.preventDefault();
      event.stopPropagation();
      deleteChat(delBtn.getAttribute("data-delete-id"));
      return;
    }
    const card = event.target.closest(".recent-chat-card");
    if (!card) return;
    openChat(card.getAttribute("data-chat-id"));
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
  renderPromptSection();
})();
