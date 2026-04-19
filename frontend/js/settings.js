// Settings page controller.

(async function initSettings() {
  "use strict";
  await profileStorage.ready();

  const backBtn = document.getElementById("backBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const languageBtn = document.getElementById("languageBtn");
  const currentLanguageText = document.getElementById("currentLanguageText");

  const languageSheetOverlay = document.getElementById("languageSheetOverlay");
  const closeLanguageSheet = document.getElementById("closeLanguageSheet");
  const languageOptions = document.querySelectorAll(".language-option");

  function updateLanguageUI(language) {
    if (currentLanguageText) currentLanguageText.textContent = language;

    languageOptions.forEach((option) => {
      const isSelected = option.dataset.language === language;
      option.classList.toggle("selected", isSelected);
    });
  }

  function openLanguageSheet() {
    if (languageSheetOverlay) {
      languageSheetOverlay.classList.remove("hidden");
    }
  }

  function closeLanguageSheetModal() {
    if (languageSheetOverlay) {
      languageSheetOverlay.classList.add("hidden");
    }
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "DashboardPage.html";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      // Disable the button so a frustrated double-click can't fire a second
      // logout request while the first one is still in flight.
      logoutBtn.disabled = true;
      try {
        // Clears the server session + in-memory cache. For Quick Start
        // (guest) accounts the server also cascade-deletes the account
        // itself — guest data isn't meant to persist across a logout.
        await profileStorage.logout();
      } catch (err) {
        // profileStorage.logout() already swallows errors internally, but
        // belt-and-suspenders: never leave the user stuck on Settings.
        console.warn("settings: logout failed –", err && err.message);
      } finally {
        window.location.href = "LoginPage.html";
      }
    });
  }

  if (languageBtn) {
    languageBtn.addEventListener("click", () => {
      openLanguageSheet();
    });
  }

  if (closeLanguageSheet) {
    closeLanguageSheet.addEventListener("click", () => {
      closeLanguageSheetModal();
    });
  }

  if (languageSheetOverlay) {
    languageSheetOverlay.addEventListener("click", (event) => {
      if (event.target === languageSheetOverlay) {
        closeLanguageSheetModal();
      }
    });
  }

  languageOptions.forEach((option) => {
    option.addEventListener("click", async () => {
      const selectedLanguage = option.dataset.language;
      if (!selectedLanguage) return;
      if (selectedLanguage === profileStorage.getLanguage()) {
        closeLanguageSheetModal();
        return;
      }

      // Avoid re-entrant clicks while the DB save is in flight. The picker
      // is briefly un-dismissible — that's fine, it's a <200ms round trip.
      languageOptions.forEach((o) => o.classList.add("is-saving"));

      try {
        // saveLanguage() writes to localStorage synchronously BEFORE the
        // network round-trip, so the page-reload below will pick up the
        // new translations regardless of server latency.
        await profileStorage.saveLanguage(selectedLanguage);
        updateLanguageUI(selectedLanguage);
        closeLanguageSheetModal();
        // Reload so every already-translated string on the page refreshes
        // through i18n.js with the newly-saved language.
        window.location.reload();
      } catch (err) {
        // Server rejected the save (e.g. dropped session). Surface the
        // error but keep the picker usable.
        console.warn("settings: saveLanguage failed –", err && err.message);
        languageOptions.forEach((o) => o.classList.remove("is-saving"));
        window.alert(
          (err && err.message) ||
            "Could not save your language choice. Please try again."
        );
      }
    });
  });

  // Paint the initial language UI state from the cached (server-confirmed)
  // language so the picker shows the right "selected" row on first render.
  updateLanguageUI(profileStorage.getLanguage());
})();