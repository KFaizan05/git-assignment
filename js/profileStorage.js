// Shared helper for per-user account storage.
// Every page that touches login state, profile data, or account credentials
// should include this script BEFORE its own script so `window.profileStorage`
// is available.
//
// Storage layout (all in localStorage):
//   labelwiseCurrentUser : "<email>"                         -- who's "logged in"
//   labelwiseAccounts    : { "<email>": { password } }       -- credentials
//   labelwiseProfiles    : { "<email>": { name, dietary, allergens } }
//   labelwiseScans       : { "<email>": [ { id, productName, ... } ] }
//
// The hard-coded demo account (user@gmail.com / user123) is seeded on first
// load so Login always works out of the box.

(function initProfileStorage() {
  "use strict";

  const CURRENT_USER_KEY = "labelwiseCurrentUser";
  const ACCOUNTS_KEY = "labelwiseAccounts";
  const PROFILES_KEY = "labelwiseProfiles";
  const SCANS_KEY = "labelwiseScans";

  const EMPTY_PROFILE = Object.freeze({ name: "", dietary: [], allergens: [], customAllergens: [] });

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn(`profileStorage: could not parse ${key}`, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  const api = {
    // ---- Session ----------------------------------------------------------
    getCurrentUser() {
      return localStorage.getItem(CURRENT_USER_KEY) || null;
    },
    setCurrentUser(email) {
      localStorage.setItem(CURRENT_USER_KEY, normalizeEmail(email));
    },
    clearCurrentUser() {
      localStorage.removeItem(CURRENT_USER_KEY);
    },

    // ---- Accounts ---------------------------------------------------------
    getAccounts() {
      return readJSON(ACCOUNTS_KEY, {});
    },
    accountExists(email) {
      return Object.prototype.hasOwnProperty.call(api.getAccounts(), normalizeEmail(email));
    },
    /**
     * Create an account. `password` may be null for a passwordless Quick Start
     * account (cannot log back in via the Login page, but the profile slot is
     * still isolated by email).
     */
    createAccount(email, password) {
      const accounts = api.getAccounts();
      accounts[normalizeEmail(email)] = { password: password == null ? null : String(password) };
      writeJSON(ACCOUNTS_KEY, accounts);
    },
    verifyCredentials(email, password) {
      const accounts = api.getAccounts();
      const entry = accounts[normalizeEmail(email)];
      return !!entry && entry.password !== null && entry.password === password;
    },
    /**
     * A "guest" account is one created by Quick Start: it has no password,
     * so it can never log back in. Its data is wiped on logout.
     */
    isGuestAccount(email) {
      const accounts = api.getAccounts();
      const entry = accounts[normalizeEmail(email)];
      return !!entry && entry.password === null;
    },
    deleteAccount(email) {
      const key = normalizeEmail(email);

      const accounts = api.getAccounts();
      if (key in accounts) {
        delete accounts[key];
        writeJSON(ACCOUNTS_KEY, accounts);
      }

      const profiles = readJSON(PROFILES_KEY, {});
      if (key in profiles) {
        delete profiles[key];
        writeJSON(PROFILES_KEY, profiles);
      }

      const scans = readJSON(SCANS_KEY, {});
      if (key in scans) {
        delete scans[key];
        writeJSON(SCANS_KEY, scans);
      }
    },

    // ---- Profiles ---------------------------------------------------------
    getProfile(email) {
      const profiles = readJSON(PROFILES_KEY, {});
      const stored = profiles[normalizeEmail(email)];
      return stored
        ? {
            name: stored.name || "",
            dietary: Array.isArray(stored.dietary) ? stored.dietary : [],
            allergens: Array.isArray(stored.allergens) ? stored.allergens : [],
            customAllergens: Array.isArray(stored.customAllergens) ? stored.customAllergens : []
          }
        : { ...EMPTY_PROFILE, dietary: [], allergens: [], customAllergens: [] };
    },
    saveProfile(email, profile) {
      const profiles = readJSON(PROFILES_KEY, {});
      profiles[normalizeEmail(email)] = {
        name: profile.name || "",
        dietary: Array.isArray(profile.dietary) ? profile.dietary : [],
        allergens: Array.isArray(profile.allergens) ? profile.allergens : [],
        customAllergens: Array.isArray(profile.customAllergens)
          ? profile.customAllergens
              .map((s) => String(s || "").trim())
              .filter(Boolean)
          : []
      };
      writeJSON(PROFILES_KEY, profiles);
    },
    getCurrentProfile() {
      const user = api.getCurrentUser();
      return user ? api.getProfile(user) : { ...EMPTY_PROFILE, dietary: [], allergens: [], customAllergens: [] };
    },
    saveCurrentProfile(profile) {
      const user = api.getCurrentUser();
      if (!user) return false;
      api.saveProfile(user, profile);
      return true;
    },

    // ---- Scans ------------------------------------------------------------
    // Each scan:
    //   { id, productName, brandName, status, category, note, savedToSafe, timestamp }
    getScans(email) {
      const scans = readJSON(SCANS_KEY, {});
      const list = scans[normalizeEmail(email)];
      return Array.isArray(list) ? list : [];
    },
    saveScans(email, list) {
      const scans = readJSON(SCANS_KEY, {});
      scans[normalizeEmail(email)] = Array.isArray(list) ? list : [];
      writeJSON(SCANS_KEY, scans);
    },
    addScan(email, scan) {
      const list = api.getScans(email);
      const entry = {
        id: scan.id || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        productName: scan.productName || "Scanned Product",
        brandName: scan.brandName || "",
        status: scan.status || "Safe",
        category: scan.category || "",
        note: scan.note || "",
        savedToSafe: !!scan.savedToSafe,
        // Small data-URL thumbnail of the scanned/uploaded photo so the
        // Scan History can show a visual preview instead of a generic icon.
        // Empty string when the scan came from a manual text paste (no image).
        thumbnail: typeof scan.thumbnail === "string" ? scan.thumbnail : "",
        timestamp: scan.timestamp || Date.now()
      };
      list.unshift(entry); // newest first
      api.saveScans(email, list);
      return entry;
    },
    updateScan(email, id, patch) {
      const list = api.getScans(email);
      const idx = list.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch };
      api.saveScans(email, list);
      return list[idx];
    },
    deleteScan(email, id) {
      const list = api.getScans(email).filter((s) => s.id !== id);
      api.saveScans(email, list);
    },
    getCurrentScans() {
      const user = api.getCurrentUser();
      return user ? api.getScans(user) : [];
    },
    addCurrentScan(scan) {
      const user = api.getCurrentUser();
      if (!user) return null;
      return api.addScan(user, scan);
    },
    updateCurrentScan(id, patch) {
      const user = api.getCurrentUser();
      if (!user) return null;
      return api.updateScan(user, id, patch);
    },

    // ---- Logout -----------------------------------------------------------
    /**
     * Log the current user out. If they were a guest (Quick Start) account,
     * their credentials and profile are also deleted from localStorage so
     * nothing persists — guest accounts are ephemeral by design.
     * Signed-up accounts keep their data so they can log back in later.
     */
    logout() {
      const user = api.getCurrentUser();
      if (user && api.isGuestAccount(user)) {
        api.deleteAccount(user);
      }
      api.clearCurrentUser();
    },

    // ---- Utilities --------------------------------------------------------
    normalizeEmail
  };

  // Seed the hard-coded demo account so the Login page always has something
  // to authenticate against, even on a brand-new browser / after clearing data.
  if (!api.accountExists("user@gmail.com")) {
    api.createAccount("user@gmail.com", "user123");
  }

  window.profileStorage = api;
})();
