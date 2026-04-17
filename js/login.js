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

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Please enter both your email and password.");
    return;
  }

  if (profileStorage.verifyCredentials(email, password)) {
    profileStorage.setCurrentUser(email);
    clearError();
    window.location.href = "DashboardPage.html";
  } else {
    showError("Invalid email or password. Please try again.");
    passwordInput.value = "";
    passwordInput.focus();
  }
});

// Clear the error as soon as the user starts correcting their input.
[emailInput, passwordInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (!errorMsg.hidden) clearError();
  });
});
