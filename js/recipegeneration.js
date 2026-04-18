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
  
  // WARNING: Exposing your API key on the frontend is for prototyping only.
  const OPENAI_API_KEY = ""; // openai key will be added here later when the final project is done, the AI chat bot works fully

  // --- Utility Functions ---

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildProfileSummary() {
    const profile = profileStorage.getCurrentProfile();
    const dietary = Array.isArray(profile.dietary) ? profile.dietary : [];
    const allergens = Array.isArray(profile.allergens) ? profile.allergens : [];

    const parts = [];
    if (dietary.length) parts.push(`dietary: ${dietary.join(", ")}`);
    if (allergens.length) parts.push(`avoiding: ${allergens.join(", ")}`);
    return parts.length ? parts.join(" • ") : "No dietary preferences set.";
  }

  // --- Functional AI Logic ---

  async function callOpenAI(prompt) {
    const profile = profileStorage.getCurrentProfile();
    const dietary = profile.dietary?.join(", ") || "None";
    const allergens = profile.allergens?.join(", ") || "None";
    
    // 1. Show Loading State
    recipeContent.innerHTML = `
      <div class="ai-bubble">
        <p class="loading-text">👨‍🍳 Chef is typing...</p>
      </div>
    `;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o", 
          messages: [
            {
              role: "system",
              content: `You are an expert AI Chef. 
                User Dietary Profile: ${dietary}. 
                User Allergies: ${allergens}.
                Instruction: Create a recipe based on the user's prompt. 
                Crucially, you MUST NOT use any ingredients listed in the Allergies. 
                Keep the tone helpful and concise. Format with Markdown.`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);

      const markdown = data.choices[0].message.content;

      // 2. Render Response
      // If you have marked.js installed, use: recipeContent.innerHTML = marked.parse(markdown);
      // Otherwise, we use a simple formatted block:
      recipeContent.innerHTML = `
        <div class="ai-bubble">
          <div style="white-space: pre-wrap;">${escapeHtml(markdown)}</div>
        </div>
      `;

    } catch (err) {
      console.error("AI Error:", err);
      recipeContent.innerHTML = `
        <div class="ai-bubble error">
          <p>⚠️ Sorry, I had trouble reaching the kitchen. Make sure your API key is correct.</p>
        </div>
      `;
    }
  }

  function showPromptResponse(prompt) {
    const clean = String(prompt || "").trim();

    if (!clean) {
      userMessageBlock.hidden = true;
      aiIntro.textContent = "What would you like to cook?";
      emptyState.hidden = false;
      return;
    }

    userPromptEl.textContent = clean;
    userMessageBlock.hidden = false;
    emptyState.hidden = true;

    const summary = buildProfileSummary();
    aiIntro.innerHTML = `
      Coming right up! 🍽️<br>
      <small style="opacity: 0.8;">Applying filters: ${escapeHtml(summary)}</small>
    `;

    // Fire the real API call
    callOpenAI(clean);
  }

  // --- UI Interactivity ---

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
    recipeContent.scrollTop = recipeContent.scrollHeight;
  }

  backBtn.addEventListener("click", () => {
    window.location.href = "AIChatbotPage.html";
  });

  chatSendBtn.addEventListener("click", submitFromComposer);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitFromComposer();
    }
  });

  // Initial Run
  const initialPrompt = sessionStorage.getItem(PROMPT_STORAGE_KEY) || "";
  showPromptResponse(initialPrompt);
})();