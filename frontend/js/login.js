// Login against the per-user account store in profileStorage.
// The hard-coded demo account (user@gmail.com / user123) is seeded by
// profileStorage.js, so it always works. Sign-up accounts can also log in.

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMsg = document.getElementById("loginError");

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.hidden = true;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Please enter both your email and password.");
    return;
  }

  // Disable the submit button so the user can't fire duplicate logins while
  // the round-trip to the PHP API is in flight.
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await profileStorage.login(email, password);
    clearError();
    window.location.href = "DashboardPage.html";
  } catch (err) {
    showError(err && err.message ? err.message : "Login failed. Try again.");
    passwordInput.value = "";
    passwordInput.focus();
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

// Clear the error as soon as the user starts correcting their input.
[emailInput, passwordInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (!errorMsg.hidden) clearError();
  });
});
