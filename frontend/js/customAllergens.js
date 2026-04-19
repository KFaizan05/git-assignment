// Shared helper that powers the "Custom Allergens" list on Create Profile
// and Edit Profile. A custom allergen is just a free-form string the user
// wants flagged in scans (e.g. "sugar", "corn syrup", "MSG"). They can add,
// edit, or delete entries; the list is returned via `getList()` so the
// hosting page can persist it alongside the rest of the profile.
//
// Usage:
//   const custom = customAllergens.init({
//     listEl: document.getElementById("customAllergenList"),
//     inputEl: document.getElementById("customAllergenInput"),
//     addBtn:  document.getElementById("customAllergenAddBtn"),
//     initial: profile.customAllergens // optional
//   });
//   ...
//   const values = custom.getList(); // -> ["sugar", "corn syrup"]

(function initCustomAllergensModule() {
  "use strict";

  const MAX_LEN = 40; // keep pills readable

  function normalize(value) {
    return String(value || "").trim();
  }

  function sameAllergen(a, b) {
    return normalize(a).toLowerCase() === normalize(b).toLowerCase();
  }

  function init(opts) {
    const listEl = opts.listEl;
    const inputEl = opts.inputEl;
    const addBtn = opts.addBtn;
    if (!listEl || !inputEl || !addBtn) {
      console.warn("customAllergens.init: missing elements");
      return { getList: () => [], setList: () => {} };
    }

    let items = Array.isArray(opts.initial)
      ? opts.initial.map(normalize).filter(Boolean)
      : [];

    function render() {
      if (items.length === 0) {
        listEl.innerHTML = `<p class="custom-allergen-empty">No custom allergens yet. Add one above — e.g. <em>sugar</em>, <em>corn syrup</em>, or <em>MSG</em>.</p>`;
        return;
      }

      listEl.innerHTML = items
        .map((item, index) => {
          const safe = escapeHtml(item);
          return `
            <div class="custom-allergen-chip" data-index="${index}">
              <span class="chip-label">${safe}</span>
              <button type="button" class="chip-btn chip-edit" data-action="edit" data-index="${index}" aria-label="Edit ${safe}">&#9998;</button>
              <button type="button" class="chip-btn chip-delete" data-action="delete" data-index="${index}" aria-label="Remove ${safe}">&times;</button>
            </div>
          `;
        })
        .join("");
    }

    function escapeHtml(text) {
      return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function addFromInput() {
      const value = normalize(inputEl.value);
      if (!value) return;
      if (value.length > MAX_LEN) {
        inputEl.value = value.slice(0, MAX_LEN);
        flashInput();
        return;
      }
      if (items.some((existing) => sameAllergen(existing, value))) {
        // Already in list — just clear input, no dup.
        inputEl.value = "";
        return;
      }
      items.push(value);
      inputEl.value = "";
      render();
    }

    function flashInput() {
      inputEl.classList.add("custom-allergen-input--flash");
      setTimeout(() => inputEl.classList.remove("custom-allergen-input--flash"), 400);
    }

    function handleListClick(event) {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const idx = Number(btn.dataset.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) return;

      if (action === "delete") {
        items.splice(idx, 1);
        render();
        return;
      }

      if (action === "edit") {
        const current = items[idx];
        // Use prompt() for a lightweight inline edit. Anything non-empty
        // replaces the entry; cancel/empty leaves it unchanged.
        const next = window.prompt("Edit custom allergen", current);
        if (next == null) return;
        const cleaned = normalize(next).slice(0, MAX_LEN);
        if (!cleaned) return;
        // If the edited value already exists elsewhere, merge (drop the old).
        const dupIdx = items.findIndex(
          (other, otherIdx) => otherIdx !== idx && sameAllergen(other, cleaned)
        );
        if (dupIdx !== -1) {
          items.splice(idx, 1);
        } else {
          items[idx] = cleaned;
        }
        render();
      }
    }

    addBtn.addEventListener("click", addFromInput);
    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addFromInput();
      }
    });
    listEl.addEventListener("click", handleListClick);

    render();

    return {
      getList() {
        return items.slice();
      },
      setList(next) {
        items = Array.isArray(next) ? next.map(normalize).filter(Boolean) : [];
        render();
      }
    };
  }

  window.customAllergens = { init };
})();
