// Edit Profile page — reads & writes the CURRENT user's profile slot.
// If no user is logged in, we send them back to the login page so they can't
// accidentally edit an unassigned profile.

const nameInput = document.getElementById("name");
const backBtn = document.getElementById("backBtn");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const optionButtons = document.querySelectorAll(".option-btn");

const currentUser = profileStorage.getCurrentUser();

if (!currentUser) {
  // No one is logged in — bounce to login.
  window.location.replace("LoginPage.html");
}

function applyProfileToUI(profile) {
  nameInput.value = profile.name || "";

  optionButtons.forEach((button) => {
    button.classList.remove("selected"); // reset first
    const group = button.dataset.group;
    const value = button.dataset.value;

    if (group === "dietary" && profile.dietary.includes(value)) {
      button.classList.add("selected");
    }
    if (group === "allergens" && profile.allergens.includes(value)) {
      button.classList.add("selected");
    }
  });
}

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

optionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("selected");
  });
});

function leaveEdit() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "SettingsPage.html";
  }
}

saveBtn.addEventListener("click", () => {
  const profile = collectProfileFromUI();
  const ok = profileStorage.saveCurrentProfile(profile);
  if (!ok) {
    // Shouldn't happen — we already bounced on page load — but be defensive.
    window.location.href = "LoginPage.html";
    return;
  }
  leaveEdit();
});

cancelBtn.addEventListener("click", leaveEdit);
backBtn.addEventListener("click", leaveEdit);

// Pre-fill with the current user's profile.
applyProfileToUI(profileStorage.getCurrentProfile());
