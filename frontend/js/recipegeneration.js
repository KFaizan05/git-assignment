(async function initRecipeGeneration() {
  "use strict";

  // Hydrate from the server before any profileStorage getter is used.
  await profileStorage.ready();

  const backBtn = document.getElementById("backBtn");
  const userMessageBlock = document.getElementById("userMessageBlock");
  const userPromptEl = document.getElementById("userPrompt");
  const aiIntro = document.getElementById("aiIntro");
  const emptyState = document.getElementById("emptyState");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const recipeContent = document.getElementById("recipeContent");

  const PROMPT_STORAGE_KEY = "labelwiseChefPrompt";
  const REVISIT_CHAT_KEY = "labelwiseChefRevisitChatId";

  const OPENAI_API_KEY = String(window.__LABELWISE_OPENAI_API_KEY__ || "").trim();

  // Tracks the saved chat id for the conversation rendered on this page so
  // a follow-up message can update the same record instead of creating a
  // duplicate. Set when (a) the user revisited from AIChatbot's recents,
  // or (b) we successfully saved a fresh AI response.
  let currentChatId = "";

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

  // Persist the chat thread to the user's account so it shows up on the
  // AIChatbotPage recents list. Best-effort — failures here shouldn't break
  // the visible conversation.
  async function persistChat(prompt, response) {
    const cleanPrompt = String(prompt || "").trim();
    const cleanResponse = String(response || "").trim();
    if (!cleanPrompt || !cleanResponse) return;
    if (!profileStorage.getCurrentUser()) return;

    try {
      if (currentChatId) {
        // Refresh an existing thread (e.g. after a follow-up message).
        await profileStorage.updateCurrentChat(currentChatId, {
          prompt: cleanPrompt,
          response: cleanResponse,
          timestamp: Date.now()
        });
      } else {
        const saved = await profileStorage.addCurrentChat({
          prompt: cleanPrompt,
          response: cleanResponse,
          timestamp: Date.now()
        });
        if (saved && saved.id) currentChatId = saved.id;
      }
    } catch (err) {
      console.warn("recipegeneration: could not persist chat", err);
    }
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
      if (!OPENAI_API_KEY) {
        throw new Error(
          "Missing OpenAI key. Add it to frontend/js/openai-config.local.js"
        );
      }
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
      recipeContent.innerHTML = `
        <div class="ai-bubble">
          <div style="white-space: pre-wrap;">${escapeHtml(markdown)}</div>
        </div>
      `;

      // 3. Persist so the user can revisit this chat later from AI Chef.
      await persistChat(prompt, markdown);

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

  // Render an existing saved chat WITHOUT re-calling the AI. Used when the
  // user opens this page from the AIChatbot recents list.
  function showSavedChat(chat) {
    if (!chat) return;
    currentChatId = chat.id || "";
    const prompt = String(chat.prompt || "");
    const response = String(chat.response || "");

    userPromptEl.textContent = prompt;
    userMessageBlock.hidden = !prompt;
    emptyState.hidden = true;

    aiIntro.textContent = "Picking up where you left off:";

    recipeContent.innerHTML = `
      <div class="chat-message user-message">
        <p>${escapeHtml(prompt)}</p>
      </div>
      <div class="chat-message ai-message">
        <div class="ai-avatar">✨</div>
        <div class="ai-bubble-wrap">
          <div class="ai-bubble">
            <div style="white-space: pre-wrap;">${escapeHtml(response)}</div>
          </div>
        </div>
      </div>
    `;
  }

  // --- UI Interactivity ---

  function submitFromComposer() {
    const value = chatInput.value.trim();
    if (!value) return;
    try {
      sessionStorage.setItem(PROMPT_STORAGE_KEY, value);
      // A typed-in follow-up creates a brand-new chat record so threads
      // don't get clobbered by unrelated questions.
      currentChatId = "";
      sessionStorage.removeItem(REVISIT_CHAT_KEY);
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

  // Initial Run — figure out whether this is a revisit or a fresh prompt.
  // Revisit takes priority: if AIChatbot stored a chat id in sessionStorage,
  // we render that saved chat verbatim instead of re-calling OpenAI (which
  // would burn tokens AND produce a slightly different recipe).
  const revisitChatId = sessionStorage.getItem(REVISIT_CHAT_KEY) || "";
  sessionStorage.removeItem(REVISIT_CHAT_KEY);

  if (revisitChatId) {
    const chats = profileStorage.getCurrentChats();
    const chat = chats.find((c) => String(c.id) === String(revisitChatId));
    if (chat) {
      showSavedChat(chat);
    } else {
      // Stored id no longer matches anything (deleted from another tab).
      // Fall back to the empty state.
      showPromptResponse("");
    }
  } else {
    const initialPrompt = sessionStorage.getItem(PROMPT_STORAGE_KEY) || "";
    showPromptResponse(initialPrompt);
  }
})();
