// Sign Up page — creates a real account (email + password) and sets them
// as the current user. They land on Create Profile to fill in preferences.

const signupForm = document.getElementById("signupForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");
const errorMsg = document.getElementById("signupError");

const ruleLength = document.getElementById("rule-length");
const ruleUppercase = document.getElementById("rule-uppercase");
const ruleSpecial = document.getElementById("rule-special");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.hidden = true;
}

// Live password-rule indicators (same feedback the old inline script gave).
passwordInput.addEventListener("input", () => {
  const value = passwordInput.value;
  ruleLength.style.color = value.length >= 8 ? "green" : "red";
  ruleUppercase.style.color = /[A-Z]/.test(value) ? "green" : "red";
  ruleSpecial.style.color = /[0-9!@#$%^&*]/.test(value) ? "green" : "red";
});

function passwordMeetsRules(pw) {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9!@#$%^&*]/.test(pw);
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  if (!email || !password || !confirm) {
    showError("Please fill in all fields.");
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    showError("Please enter a valid email address.");
    return;
  }
  if (!passwordMeetsRules(password)) {
    showError("Password must meet all three rules listed above.");
    return;
  }
  if (password !== confirm) {
    showError("Passwords do not match.");
    return;
  }

  // Block double-submits while the server call is in flight.
  const submitBtn = signupForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await profileStorage.signup(email, password);
    clearError();
    // Send them to Create Profile to fill in preferences. The page starts
    // blank (fresh slate) and will save into their isolated slot.
    window.location.href = "CreateProfilePage.html";
  } catch (err) {
    // The server returns 409 + "An account with that email already exists."
    // for the duplicate-email case, which flows through to this message.
    showError(err && err.message ? err.message : "Sign-up failed. Try again.");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

[emailInput, passwordInput, confirmInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (!errorMsg.hidden) clearError();
  });
});
