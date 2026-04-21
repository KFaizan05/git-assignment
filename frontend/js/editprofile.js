// Edit Profile page — reads & writes the CURRENT user's profile slot on the
// server. If no user is logged in, we send them back to the login page so
// they can't accidentally edit an unassigned profile.

(async function initEditProfile() {
  "use strict";

  // Hydrate the client cache before inspecting session state.
  await profileStorage.ready();

  const nameInput = document.getElementById("name");
  const backBtn = document.getElementById("backBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const optionButtons = document.querySelectorAll(".option-btn");

  if (!profileStorage.getCurrentUser()) {
    window.location.replace("LoginPage.html");
    return;
  }

  // Custom allergens — free-form strings the user wants flagged in scans.
  const customAllergenManager = (window.customAllergens && window.customAllergens.init)
    ? window.customAllergens.init({
        listEl: document.getElementById("customAllergenList"),
        inputEl: document.getElementById("customAllergenInput"),
        addBtn: document.getElementById("customAllergenAddBtn"),
        initial: []
      })
    : { getList: () => [], setList: () => {} };

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

    customAllergenManager.setList(profile.customAllergens || []);
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
      allergens,
      customAllergens: customAllergenManager.getList()
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

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      const profile = collectProfileFromUI();
      const ok = await profileStorage.saveCurrentProfile(profile);
      if (!ok) {
        // Session lapsed server-side — bounce back to login.
        window.location.href = "LoginPage.html";
        return;
      }
      leaveEdit();
    } catch (err) {
      // Surface the error inline by tweaking the button label briefly; the
      // Edit Profile page doesn't have a dedicated error box.
      console.error("editprofile: save failed –", err && err.message);
      alert(err && err.message ? err.message : "Could not save your profile.");
    } finally {
      saveBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener("click", leaveEdit);
  backBtn.addEventListener("click", leaveEdit);

  // Pre-fill with the current user's profile (cached from ready()).
  applyProfileToUI(profileStorage.getCurrentProfile());
})();
