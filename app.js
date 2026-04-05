/**
 * ============================================================================
 * AI Chef Recipe — client-side application logic
 * Author: Faizan Kalam
 * ============================================================================
 * This file powers the chatbot, OpenAI API calls, local storage for chat/history,
 * screen navigation, and the ingredient photo scan (vision). The UI markup lives
 * in index.html; layout overrides in app.css.
 * ============================================================================
 */

(function () {
  "use strict";

  // --------------------------------------------------------------------------
  // Constants: localStorage keys and OpenAI model names
  // --------------------------------------------------------------------------
  /** Key used to read/write the user's OpenAI API key in localStorage. */
  var API_KEY_STORAGE = "openai_api_key";
  /** Key for the array of saved recipe objects (max 50 entries). */
  var HISTORY_STORAGE = "ai_recipe_saved_v1";
  /** Key for persisting the in-progress chat with the model. */
  var CHAT_STORAGE = "ai_recipe_chat_v1";
  /** Text-only chat model (fast and inexpensive). */
  var MODEL = "gpt-4o-mini";
  /** Multimodal model used to describe images from the Scan screen. */
  var VISION_MODEL = "gpt-4o";

  /**
   * System prompt: tells the model to return JSON for structured recipes,
   * or a "plain reply" shape for general conversation (parsed in safeParseRecipe).
   */
  var SYSTEM_RECIPE =
    "You are AI Chef, a helpful cooking assistant. " +
    "When the user asks for recipes, meal ideas, modifications to a dish, or cooking help that includes a concrete recipe, " +
    "reply with ONLY valid JSON (no markdown code fences, no text before or after) using this exact shape:\n" +
    '{"intro":"short friendly paragraph","title":"recipe name","time":"e.g. 15 min","servings":"e.g. 2 servings","calories":"estimate e.g. 350 cal","dietNote":"optional line about allergies/diet or empty string","ingredients":["item 1","item 2"],"instructions":["step 1","step 2"],"nutritionTags":["tag1","tag2"],"plainReply":false}\n' +
    "For general chat, tips without a full recipe, or questions that are not recipe-focused, set plainReply to true, put your full answer in intro, and use empty string for title and empty arrays for ingredients and instructions.\n" +
    "Always use plainReply false when giving a structured recipe.";

  // --------------------------------------------------------------------------
  // Small utilities
  // --------------------------------------------------------------------------

  /** Shorthand for document.querySelector (optional root for scoped search). */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  /** Escapes HTML special characters so user/model text is safe in innerHTML. */
  function escapeHtml(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Returns the stored API key, or empty string if none. */
  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || "";
  }

  /** Saves or clears the API key in localStorage. */
  function setApiKey(v) {
    if (v) localStorage.setItem(API_KEY_STORAGE, v);
    else localStorage.removeItem(API_KEY_STORAGE);
  }

  /** Shows or hides the API key modal; updates aria-hidden for accessibility. */
  function showModal(show) {
    var m = $("#api-modal");
    if (!m) return;
    m.hidden = !show;
    m.setAttribute("aria-hidden", show ? "false" : "true");
  }

  // --------------------------------------------------------------------------
  // Parsing model output into a recipe object
  // --------------------------------------------------------------------------

  /**
   * Parses JSON from the model; strips optional ```json fences if present.
   * @throws SyntaxError if the string is not valid JSON
   */
  function parseRecipeJson(text) {
    var t = String(text).trim();
    if (t.indexOf("```") === 0) {
      t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    }
    var obj = JSON.parse(t);
    return obj;
  }

  /**
   * Like parseRecipeJson but never throws: on failure returns a plainReply object
   * so the UI can still show the raw text in a safe bubble.
   */
  function safeParseRecipe(text) {
    try {
      return parseRecipeJson(text);
    } catch (e) {
      return {
        intro: text,
        title: "",
        time: "",
        servings: "",
        calories: "",
        dietNote: "",
        ingredients: [],
        instructions: [],
        nutritionTags: [],
        plainReply: true,
        _parseError: true,
      };
    }
  }

  // --------------------------------------------------------------------------
  // HTML builders for recipe cards (match classes from style.css / Figma export)
  // --------------------------------------------------------------------------

  /** Builds the "nutrition tag" pills inside the recipe card. */
  function nutritionTagsHtml(tags) {
    if (!tags || !tags.length) return "";
    var chunks = tags.slice(0, 5).map(function (tag, i) {
      var cls = i === 0 ? "text16" : i === 1 ? "text17" : "text18";
      var offset = "";
      if (i > 2) {
        cls = "text16";
        offset =
          ' style="position:relative!important;left:auto!important;top:auto!important;margin-top:8px;"';
      }
      return (
        '<div class="' +
        cls +
        '"' +
        offset +
        '><div class="high-protein">' +
        escapeHtml(tag) +
        "</div></div>"
      );
    });
    return chunks.join("");
  }

  /** Renders the bullet list of ingredient lines. */
  function ingredientsHtml(items) {
    if (!items || !items.length)
      return "<p class='chef-empty'>No ingredients listed.</p>";
    return items
      .map(function (line) {
        return (
          '<div class="list-item">' +
          '<div class="text3"><div class="div">•</div></div>' +
          '<div class="text4"><div>' +
          escapeHtml(line) +
          "</div></div></div>"
        );
      })
      .join("");
  }

  /** Renders numbered instruction steps (reuses list-item2 / list-item3 layout). */
  function instructionsHtml(items) {
    if (!items || !items.length) return "";
    return items
      .map(function (line, idx) {
        var n = idx + 1;
        var rowClass =
          idx === items.length - 1 && items.length === 4
            ? "list-item3"
            : "list-item2";
        var numClass = rowClass === "list-item3" ? "text14" : "text12";
        var bodyClass = rowClass === "list-item3" ? "text15" : "text13";
        var numInner = rowClass === "list-item3" ? "_4" : "_1";
        return (
          '<div class="' +
          rowClass +
          '">' +
          '<div class="' +
          numClass +
          '"><div class="' +
          numInner +
          '">' +
          n +
          ".</div></div>" +
          '<div class="' +
          bodyClass +
          '"><div>' +
          escapeHtml(line) +
          "</div></div></div>"
        );
      })
      .join("");
  }

  /**
   * Full assistant message: either a simple gray intro bubble (plainReply)
   * or the full recipe card (title, meta, ingredients, steps, tags).
   */
  function recipeCardHtml(data) {
    if (data.plainReply || !data.title) {
      return (
        '<div class="container10">' +
        '<div class="paragraph2" style="height:auto!important;min-height:44px;">' +
        '<div class="perfect-i-ve-created-a-quick-and-delicious-vegan dyn-intro">' +
        escapeHtml(data.intro || "") +
        "</div></div></div>"
      );
    }

    var diet = data.dietNote
      ? '<div class="container17"><div class="paragraph3"><div class="all-ingredients-are-safe-based-on-your-profile">' +
        escapeHtml(data.dietNote) +
        "</div></div></div>"
      : "";

    var nutrition = "";
    if (data.nutritionTags && data.nutritionTags.length) {
      nutrition =
        '<div class="container20">' +
        '<div class="heading-32"><div class="nutritional-highlights">Nutritional Highlights</div></div>' +
        '<div class="container21">' +
        nutritionTagsHtml(data.nutritionTags) +
        "</div></div>";
    }

    return (
      '<div class="container10">' +
      '<div class="paragraph2" style="height:auto!important;min-height:44px;">' +
      '<div class="perfect-i-ve-created-a-quick-and-delicious-vegan dyn-intro">' +
      escapeHtml(data.intro || "") +
      "</div></div></div>" +
      '<div class="container11">' +
      '<div class="container12">' +
      '<div class="heading-2"><div class="quinoa-chickpea-power-bowl">' +
      escapeHtml(data.title) +
      "</div></div>" +
      '<div class="container13">' +
      '<div class="container14"><img class="icon4" src="icon3.svg" alt="" /><div class="text"><div class="_15-min">' +
      escapeHtml(data.time || "—") +
      "</div></div></div>" +
      '<div class="container15"><img class="icon5" src="icon4.svg" alt="" /><div class="text2"><div class="_2-servings">' +
      escapeHtml(data.servings || "—") +
      "</div></div></div>" +
      '<div class="container16"><img class="icon6" src="icon5.svg" alt="" /><div class="text"><div class="_350-cal">' +
      escapeHtml(data.calories || "—") +
      "</div></div></div>" +
      "</div></div>" +
      diet +
      '<div class="container18">' +
      '<div class="heading-3"><div class="ingredients">Ingredients</div></div>' +
      '<div class="list" style="height:auto!important;">' +
      ingredientsHtml(data.ingredients) +
      "</div></div>" +
      '<div class="container19">' +
      '<div class="heading-3"><div class="instructions">Instructions</div></div>' +
      '<div class="numbered-list" style="height:auto!important;">' +
      instructionsHtml(data.instructions) +
      "</div></div>" +
      nutrition +
      "</div>"
    );
  }

  /** User message bubble (teal, right-aligned block in the thread). */
  function userBubbleHtml(text) {
    return (
      '<div class="container5">' +
      '<div class="container6">' +
      '<div class="paragraph" style="height:auto!important;min-height:40px;">' +
      '<div class="give-me-quick-vegan-lunch-ideas-i-can-prepare-in-1" style="position:relative!important;width:100%!important;height:auto!important;white-space:pre-wrap;">' +
      escapeHtml(text) +
      "</div></div></div></div>"
    );
  }

  /** Wraps inner HTML in the assistant row (avatar + content column). */
  function assistantRowHtml(inner) {
    return (
      '<div class="container7">' +
      '<div class="container8"><img class="icon3" src="icon2.svg" alt="" /></div>' +
      '<div class="container9">' +
      inner +
      "</div></div>"
    );
  }

  // --------------------------------------------------------------------------
  // Chat state: last savable recipe + full message list for the API
  // --------------------------------------------------------------------------

  /** Last successfully parsed structured recipe (used by Save Recipe). */
  var lastRecipeData = null;
  /** Alternating user / assistant messages; assistant may include .parsed cache. */
  var conversationMessages = [];

  /** Restores chat from localStorage after a page reload. */
  function loadChatFromStorage() {
    try {
      var raw = localStorage.getItem(CHAT_STORAGE);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.messages) conversationMessages = parsed.messages;
    } catch (e) {
      /* ignore corrupt storage */
    }
  }

  /** Persists the current conversation for refresh continuity. */
  function saveChatToStorage() {
    try {
      localStorage.setItem(
        CHAT_STORAGE,
        JSON.stringify({ messages: conversationMessages })
      );
    } catch (e) {
      /* quota exceeded or private mode */
    }
  }

  /**
   * Rebuilds #messages-root from conversationMessages: each "turn" is user bubble
   * plus optional assistant recipe card. Shows #chef-empty when there is no chat.
   */
  function renderChefThread() {
    var root = $("#messages-root");
    var empty = $("#chef-empty");
    if (!root) return;
    root.innerHTML = "";
    if (!conversationMessages.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    var i = 0;
    while (i < conversationMessages.length) {
      var m = conversationMessages[i];
      if (m.role === "user") {
        var turn = document.createElement("div");
        turn.className = "chat-turn";
        turn.innerHTML = userBubbleHtml(m.content);
        var assistantContent = "";
        if (
          conversationMessages[i + 1] &&
          conversationMessages[i + 1].role === "assistant"
        ) {
          var asst = conversationMessages[i + 1];
          var data = asst.parsed || safeParseRecipe(asst.content);
          assistantContent = recipeCardHtml(data);
          i += 2;
        } else {
          i += 1;
        }
        if (assistantContent) {
          turn.innerHTML += assistantRowHtml(assistantContent);
        }
        root.appendChild(turn);
      } else {
        i += 1;
      }
    }
    root.scrollTop = root.scrollHeight;
  }

  // --------------------------------------------------------------------------
  // OpenAI HTTP API
  // --------------------------------------------------------------------------

  /**
   * POST /v1/chat/completions with the given messages array.
   * @param {Array} messages OpenAI chat messages (system + user + assistant)
   * @param {string} [model] optional model override (default MODEL)
   * @returns {Promise<string>} assistant message content text
   */
  function openaiChat(messages, model) {
    var key = getApiKey();
    if (!key) return Promise.reject(new Error("missing_api_key"));

    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: model || MODEL,
        messages: messages,
        temperature: 0.7,
      }),
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          var msg =
            (body.error && body.error.message) ||
            res.statusText ||
            "Request failed";
          throw new Error(msg);
        }
        var choice = body.choices && body.choices[0];
        if (!choice || !choice.message)
          throw new Error("No response from model");
        return choice.message.content;
      });
    });
  }

  /** Builds the request body messages: system prompt + stored conversation. */
  function buildApiMessages() {
    var out = [{ role: "system", content: SYSTEM_RECIPE }];
    conversationMessages.forEach(function (m) {
      if (m.role === "user") out.push({ role: "user", content: m.content });
      else if (m.role === "assistant")
        out.push({ role: "assistant", content: m.content });
    });
    return out;
  }

  /**
   * Reads #chef-input, appends user message, shows loading row, calls OpenAI,
   * then appends assistant message and re-renders. Errors show a red banner.
   */
  function sendChefMessage() {
    var input = $("#chef-input");
    var text = (input && input.value) || "";
    text = text.trim();
    if (!text) return;

    if (!getApiKey()) {
      showModal(true);
      return;
    }

    conversationMessages.push({ role: "user", content: text });
    if (input) input.value = "";
    renderChefThread();

    var root = $("#messages-root");
    var loadingEl = document.createElement("div");
    loadingEl.className = "chat-turn";
    loadingEl.innerHTML = assistantRowHtml(
      '<div class="app-loading">Thinking…</div>'
    );
    if (root) {
      root.appendChild(loadingEl);
      root.scrollTop = root.scrollHeight;
    }

    openaiChat(buildApiMessages())
      .then(function (content) {
        if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        var parsed = safeParseRecipe(content);
        lastRecipeData = parsed.plainReply ? null : parsed;
        conversationMessages.push({
          role: "assistant",
          content: content,
          parsed: parsed,
        });
        saveChatToStorage();
        renderChefThread();
      })
      .catch(function (err) {
        if (loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
        var errEl = document.createElement("div");
        errEl.className = "chat-turn";
        errEl.innerHTML = assistantRowHtml(
          '<div class="app-error">' + escapeHtml(err.message) + "</div>"
        );
        if (root) {
          root.appendChild(errEl);
          root.scrollTop = root.scrollHeight;
        }
      });
  }

  // --------------------------------------------------------------------------
  // Saved recipes (History tab)
  // --------------------------------------------------------------------------

  /** Pushes lastRecipeData onto history in localStorage (cap 50 items). */
  function saveRecipe() {
    if (!lastRecipeData || lastRecipeData.plainReply || !lastRecipeData.title) {
      alert("Ask the AI for a recipe first, then save.");
      return;
    }
    var list = loadHistory();
    list.unshift({
      id: String(Date.now()),
      savedAt: new Date().toISOString(),
      recipe: lastRecipeData,
    });
    localStorage.setItem(HISTORY_STORAGE, JSON.stringify(list.slice(0, 50)));
    alert('Saved "' + lastRecipeData.title + '"');
    renderHistoryList();
  }

  /** Returns parsed history array or []. */
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_STORAGE);
      if (!raw) return [];
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Renders #history-list from loadHistory(); wires Open / Remove buttons.
   */
  function renderHistoryList() {
    var ul = $("#history-list");
    var empty = $("#history-empty");
    if (!ul) return;
    var items = loadHistory();
    ul.innerHTML = "";
    if (!items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    items.forEach(function (entry) {
      var r = entry.recipe;
      var li = document.createElement("li");
      li.className = "history-item";
      var title = (r && r.title) || "Recipe";
      var d = new Date(entry.savedAt);
      li.innerHTML =
        "<h3>" +
        escapeHtml(title) +
        "</h3><time>" +
        escapeHtml(d.toLocaleString()) +
        "</time>" +
        '<div class="history-item-actions">' +
        '<button type="button" class="btn-open" data-id="' +
        escapeHtml(entry.id) +
        '">Open in AI Chef</button>' +
        '<button type="button" class="btn-remove" data-id="' +
        escapeHtml(entry.id) +
        '">Remove</button>' +
        "</div>";
      ul.appendChild(li);
    });

    ul.querySelectorAll(".btn-open").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var found = loadHistory().filter(function (x) {
          return x.id === id;
        })[0];
        if (!found) return;
        openRecipeInChef(found.recipe);
        switchScreen("chef");
        setNavActive("chef");
      });
    });
    ul.querySelectorAll(".btn-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var next = loadHistory().filter(function (x) {
          return x.id !== id;
        });
        localStorage.setItem(HISTORY_STORAGE, JSON.stringify(next));
        renderHistoryList();
      });
    });
  }

  /**
   * Replaces the chat with a synthetic turn that displays a saved recipe card.
   */
  function openRecipeInChef(recipe) {
    lastRecipeData = recipe;
    var fakeContent = JSON.stringify(recipe);
    conversationMessages = [
      { role: "user", content: "Show saved recipe" },
      { role: "assistant", content: fakeContent, parsed: recipe },
    ];
    saveChatToStorage();
    renderChefThread();
  }

  // --------------------------------------------------------------------------
  // Navigation between Home / Chef / Scan / History
  // --------------------------------------------------------------------------

  /** Toggles .is-active on .app-screen elements by data-screen name. */
  function switchScreen(name) {
    document.querySelectorAll(".app-screen").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-screen") === name);
    });
  }

  /** Highlights the bottom nav button matching the current screen. */
  function setNavActive(name) {
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-nav") === name);
    });
  }

  // --------------------------------------------------------------------------
  // Scan tab: image file → data URL → vision model
  // --------------------------------------------------------------------------

  /** Reads selected file, posts image + prompt to gpt-4o, prints text in #scan-result. */
  function scanAnalyze() {
    var fileInput = $("#scan-file");
    var result = $("#scan-result");
    var btn = $("#scan-analyze");
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      alert("Choose a photo first.");
      return;
    }
    if (!getApiKey()) {
      showModal(true);
      return;
    }

    var file = fileInput.files[0];
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      if (btn) btn.disabled = true;
      if (result) result.textContent = "Analyzing image…";

      var key = getApiKey();
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "List visible food ingredients or products in this image. " +
                    "Then suggest one simple recipe the user could make with them. " +
                    "Be concise and practical.",
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          max_tokens: 600,
        }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok)
              throw new Error(
                (body.error && body.error.message) || res.statusText
              );
            var c = body.choices && body.choices[0];
            return (c && c.message && c.message.content) || "";
          });
        })
        .then(function (text) {
          if (result) result.textContent = text;
        })
        .catch(function (e) {
          if (result) result.textContent = "Error: " + e.message;
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    };
    reader.readAsDataURL(file);
  }

  // --------------------------------------------------------------------------
  // init: attach all event listeners and show the Home screen by default
  // --------------------------------------------------------------------------

  function init() {
    loadChatFromStorage();

    var keyInput = $("#api-key-input");
    if (keyInput && getApiKey()) keyInput.value = getApiKey();

    // Modal: save / clear API key, close on backdrop or ×
    $("#api-key-save") &&
      $("#api-key-save").addEventListener("click", function () {
        var v = (keyInput && keyInput.value.trim()) || "";
        setApiKey(v);
        showModal(false);
      });
    $("#api-key-clear") &&
      $("#api-key-clear").addEventListener("click", function () {
        setApiKey("");
        if (keyInput) keyInput.value = "";
        showModal(false);
      });
    $("#api-modal-close") &&
      $("#api-modal-close").addEventListener("click", function () {
        showModal(false);
      });
    $(".app-modal__backdrop") &&
      $(".app-modal__backdrop").addEventListener("click", function () {
        showModal(false);
      });

    // Bottom navigation
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-nav");
        switchScreen(name);
        setNavActive(name);
        if (name === "history") renderHistoryList();
      });
    });

    // AI Chef header: open API key modal
    var back = $("#header-back");
    if (back)
      back.addEventListener("click", function () {
        showModal(true);
        if (keyInput) keyInput.value = getApiKey();
      });

    // Composer: send on button click or Enter (Shift+Enter = newline)
    $("#chef-send") &&
      $("#chef-send").addEventListener("click", function () {
        sendChefMessage();
      });
    $("#chef-input") &&
      $("#chef-input").addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendChefMessage();
        }
      });

    $(".app-btn-save") &&
      $(".app-btn-save").addEventListener("click", saveRecipe);

    // Scan tab
    $("#scan-analyze") &&
      $("#scan-analyze").addEventListener("click", scanAnalyze);
    $("#scan-file") &&
      $("#scan-file").addEventListener("change", function () {
        var f = $("#scan-file").files[0];
        var preview = $("#scan-preview");
        var result = $("#scan-result");
        if (result) result.textContent = "";
        if (!f || !preview) return;
        preview.hidden = false;
        preview.src = URL.createObjectURL(f);
      });

    $(".scan-file-btn") &&
      $(".scan-file-btn").addEventListener("click", function () {
        $("#scan-file") && $("#scan-file").click();
      });

    renderChefThread();
    renderHistoryList();
    switchScreen("home");
    setNavActive("home");
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
