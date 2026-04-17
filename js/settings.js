const LANGUAGE_STORAGE_KEY = "labelwiseLanguage";

const backBtn = document.getElementById("backBtn");
const logoutBtn = document.getElementById("logoutBtn");
const languageBtn = document.getElementById("languageBtn");
const currentLanguageText = document.getElementById("currentLanguageText");

const languageSheetOverlay = document.getElementById("languageSheetOverlay");
const closeLanguageSheet = document.getElementById("closeLanguageSheet");
const languageOptions = document.querySelectorAll(".language-option");

function getSavedLanguage() {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) || "English";
}

function saveLanguage(language) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

function updateLanguageUI(language) {
  currentLanguageText.textContent = language;

  languageOptions.forEach((option) => {
    const isSelected = option.dataset.language === language;
    option.classList.toggle("selected", isSelected);
  });
}

function openLanguageSheet() {
  languageSheetOverlay.classList.remove("hidden");
}

function closeLanguageSheetModal() {
  languageSheetOverlay.classList.add("hidden");
}

backBtn.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "DashboardPage.html";
  }
});

logoutBtn.addEventListener("click", () => {
  // Clears current-user pointer. If the user was a Quick Start (guest)
  // account, also wipes their stored account + profile — guest data is
  // not meant to persist across a logout.
  profileStorage.logout();
  window.location.href = "LoginPage.html";
});

languageBtn.addEventListener("click", () => {
  openLanguageSheet();
});

closeLanguageSheet.addEventListener("click", () => {
  closeLanguageSheetModal();
});

languageSheetOverlay.addEventListener("click", (event) => {
  if (event.target === languageSheetOverlay) {
    closeLanguageSheetModal();
  }
});

languageOptions.forEach((option) => {
  option.addEventListener("click", () => {
    const selectedLanguage = option.dataset.language;
    saveLanguage(selectedLanguage);
    updateLanguageUI(selectedLanguage);
    closeLanguageSheetModal();
  });
});

updateLanguageUI(getSavedLanguage());