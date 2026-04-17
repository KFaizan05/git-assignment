// Create Profile page — completes account setup with name + preferences.
//
// Two entry points lead here:
//   1. "Sign Up" flow — signup.js already created an account with email +
//      password and set them as the current user. In this case we hide the
//      email field (they already typed it) and just collect name + options.
//   2. "Quick Start" flow — no current user yet. We show the email field and
//      create a passwordless (guest) account for whatever email they enter.
//
// Guest accounts (Quick Start) can't log back in — their data is wiped on
// logout. See profileStorage.logout().
//
// The form always starts blank (fresh slate) regardless of what's stored.

const emailInput = document.getElementById("profileEmail");
const emailField = emailInput ? emailInput.closest(".field-group") : null;
const nameInput = document.getElementById("name");
const backBtn = document.getElementById("backBtn");
const saveBtn = document.getElementById("saveBtn");
const errorMsg = document.getElementById("profileError");
const optionButtons = document.querySelectorAll(".option-btn");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// True when we arrived already signed in (i.e. from Sign Up). We skip the
// email prompt and reuse the current-user email.
function hasExistingSession() {
  return !!profileStorage.getCurrentUser();
}

// --- Error UI ----------------------------------------------------------------
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.hidden = true;
}

// --- Fresh slate on load -----------------------------------------------------
// Clear UI so nothing lingers from browser autofill or the bfcache.
// localStorage is NOT touched.
function resetForm() {
  if (emailInput) emailInput.value = "";
  nameInput.value = "";
  optionButtons.forEach((button) => button.classList.remove("selected"));
  clearError();
  applyEmailFieldVisibility();
}

// Hide/show the email row depending on whether we already have a session.
function applyEmailFieldVisibility() {
  if (!emailField) return;
  emailField.hidden = hasExistingSession();
}

resetForm();
window.addEventListener("pageshow", resetForm);

// --- Option toggles ----------------------------------------------------------
optionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("selected");
  });
});

// --- Collect the form --------------------------------------------------------
function collectProfileFromUI() {
  const dietary = [];
  const allergens = [];

  optionButtons.forEach((button) => {
    if (!button.classList.contains("selected")) return;
    const group = button.dataset.group;
    const value = button.dataset.value;
    if (group === "dietary") dietary.push(value);
    if (group === "allergens") allergens.push(value);
  });

  return {
    name: nameInput.value.trim(),
    dietary,
    allergens
  };
}

// --- Button handlers ---------------------------------------------------------
saveBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const signedIn = hasExistingSession();

  // Email only matters for the Quick Start path. Signed-in users keep the
  // email they already registered during Sign Up.
  let email;
  if (signedIn) {
    email = profileStorage.getCurrentUser();
  } else {
    email = emailInput.value.trim().toLowerCase();

    if (!email) {
      showError("Please enter an email to identify your account.");
      emailInput.focus();
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      showError("Please enter a valid email address.");
      emailInput.focus();
      return;
    }
  }

  if (!name) {
    showError("Please enter your name.");
    nameInput.focus();
    return;
  }

  // Quick Start: create a passwordless (guest) account if this email is new,
  // then set them as the current user. Signed-in users already have an
  // account, so this branch is skipped.
  if (!signedIn) {
    if (!profileStorage.accountExists(email)) {
      profileStorage.createAccount(email, null);
    }
    profileStorage.setCurrentUser(email);
  }

  profileStorage.saveProfile(email, collectProfileFromUI());

  clearError();
  window.location.href = "DashboardPage.html";
});

backBtn.addEventListener("click", () => {
  window.location.href = "LoginPage.html";
});

// Clear error as the user types.
[emailInput, nameInput].forEach((input) => {
  if (!input) return;
  input.addEventListener("input", () => {
    if (!errorMsg.hidden) clearError();
  });
});
