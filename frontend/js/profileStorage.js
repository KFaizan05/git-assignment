// Shared helper for per-user account storage.
// Every page that touches login state, profile data, or account credentials
// should include this script BEFORE its own script so `window.profileStorage`
// is available.
//
// -----------------------------------------------------------------------------
// Storage layout
// -----------------------------------------------------------------------------
// Accounts, profiles, and scans all live in a MySQL database behind a small
// PHP API under `php/api/`. The browser holds a session cookie (PHPSESSID)
// that the server uses to identify the logged-in account on every request.

(function initProfileStorage() {
  "use strict";

  const API_BASE = "../../backend/php/api/";
  const LANGUAGE_LOCAL_KEY = "labelwiseLanguage";

  const EMPTY_PROFILE = Object.freeze({
    name: "",
    language: "English",
    dietary: [],
    allergens: [],
    customAllergens: []
  });

  // In-memory mirror of the server. Reset whenever `applySnapshot(null)` is
  // called (logout, auth failure, initial state).
  let cache = {
    user: null,       // email string, or null if logged out
    isGuest: false,
    profile: null,    // { name, language, dietary[], allergens[], customAllergens[] }
    scans: []         // newest-first array of scan records
  };

  // `ready()` memoizes its fetch so concurrent callers share a single round
  // trip. `refresh()` throws it away and hydrates fresh.
  let readyPromise = null;

  // ---- Low-level HTTP helpers ------------------------------------------------

  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (networkErr) {
      // fetch() throws only on network-level failures (DNS, offline, CORS).
      // Rethrow with a uniform shape so callers can display a single message.
      const err = new Error("Network error. Is the server running?");
      err.cause = networkErr;
      err.network = true;
      throw err;
    }

    let json = null;
    try {
      json = await res.json();
    } catch (_) {
      // Non-JSON response — likely a PHP fatal or an HTML error page.
      const err = new Error(`Unexpected server response (${res.status}).`);
      err.status = res.status;
      throw err;
    }

    if (!json || json.ok !== true) {
      const err = new Error((json && json.error) || `Request failed (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function postJson(path, body) { return request("POST", path, body || {}); }
  function getJson(path)        { return request("GET",  path); }

  // ---- Cache bookkeeping -----------------------------------------------------

  /**
   * Write the current cache's language to localStorage so the synchronous
   * i18n layer picks it up on the next translate() pass. Safe to call even
   * when there's no profile (we fall back to "English").
   */
  function syncLanguageToLocalStorage() {
    try {
      const lang = (cache.profile && cache.profile.language) || "English";
      localStorage.setItem(LANGUAGE_LOCAL_KEY, lang);
    } catch (_) { /* quota / privacy mode — ignore */ }
  }

  function applySnapshot(snap) {
    if (!snap || !snap.user) {
      cache = { user: null, isGuest: false, profile: null, scans: [] };
      // On logout we deliberately DON'T clear the language key — the picker
      // on the Login page should remember what the user chose.
      return;
    }
    cache = {
      user: String(snap.user),
      isGuest: !!snap.isGuest,
      profile: {
        name:     (snap.profile && snap.profile.name)     || "",
        language: (snap.profile && snap.profile.language) || "English",
        dietary:  Array.isArray(snap.profile && snap.profile.dietary)   ? snap.profile.dietary.slice()   : [],
        allergens: Array.isArray(snap.profile && snap.profile.allergens) ? snap.profile.allergens.slice() : [],
        customAllergens: Array.isArray(snap.profile && snap.profile.customAllergens)
          ? snap.profile.customAllergens.slice()
          : []
      },
      scans: Array.isArray(snap.scans) ? snap.scans.slice() : []
    };
    syncLanguageToLocalStorage();
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  // ---- Public API ------------------------------------------------------------

  const api = {
    ready() {
      if (!readyPromise) {
        readyPromise = getJson("me.php")
          .then((json) => { applySnapshot(json); })
          .catch((err) => {
            // Treat any hydration failure (network, 500, etc.) as "logged out"
            // so pages can redirect to Login instead of getting stuck on a
            // blank render. The dev-facing detail stays in console.
            console.warn("profileStorage: hydration failed –", err && err.message);
            applySnapshot(null);
          });
      }
      return readyPromise;
    },

    /** Drop the cached promise and hit the server again. */
    refresh() {
      readyPromise = null;
      return api.ready();
    },

    // ---- Session --------------------------------------------------------
    getCurrentUser() { return cache.user; },
    isGuestAccount() { return cache.isGuest; },

    async login(email, password) {
      const json = await postJson("login.php", {
        email: normalizeEmail(email),
        password: String(password == null ? "" : password)
      });
      applySnapshot(json);
      readyPromise = Promise.resolve();
      return true;
    },

    async signup(email, password) {
      const json = await postJson("signup.php", {
        email: normalizeEmail(email),
        password: String(password == null ? "" : password)
      });
      applySnapshot(json);
      readyPromise = Promise.resolve();
      return true;
    },

    /** Create an ephemeral guest account and log it in. */
    async quickstart() {
      const json = await postJson("quickstart.php", {});
      applySnapshot(json);
      readyPromise = Promise.resolve();
      return cache.user;
    },

    async logout() {
      try {
        await postJson("logout.php", {});
      } catch (err) {
        // Even if the server call fails, clear the client cache so the UI
        // reflects "logged out".
        console.warn("profileStorage: logout server call failed –", err && err.message);
      }
      applySnapshot(null);
      readyPromise = Promise.resolve();
    },

    // ---- Profile --------------------------------------------------------
    getCurrentProfile() {
      // Return a defensive copy — callers sometimes mutate arrays in place.
      if (!cache.profile) {
        return { name: "", language: "English", dietary: [], allergens: [], customAllergens: [] };
      }
      return {
        name: cache.profile.name || "",
        language: cache.profile.language || "English",
        dietary: (cache.profile.dietary || []).slice(),
        allergens: (cache.profile.allergens || []).slice(),
        customAllergens: (cache.profile.customAllergens || []).slice()
      };
    },

    async saveCurrentProfile(profile) {
      if (!cache.user) return false;
      const payload = {
        name: String((profile && profile.name) || ""),
        dietary: Array.isArray(profile && profile.dietary) ? profile.dietary : [],
        allergens: Array.isArray(profile && profile.allergens) ? profile.allergens : [],
        customAllergens: Array.isArray(profile && profile.customAllergens)
          ? profile.customAllergens.map((s) => String(s || "").trim()).filter(Boolean)
          : []
      };
      const json = await postJson("save_profile.php", payload);
      // Sync the cache with the canonical profile the server returned.
      if (json.profile) {
        const prevLang = (cache.profile && cache.profile.language) || "English";
        cache.profile = {
          name: json.profile.name || "",
          language: prevLang,
          dietary: Array.isArray(json.profile.dietary) ? json.profile.dietary.slice() : [],
          allergens: Array.isArray(json.profile.allergens) ? json.profile.allergens.slice() : [],
          customAllergens: Array.isArray(json.profile.customAllergens)
            ? json.profile.customAllergens.slice()
            : []
        };
      }
      return true;
    },

    // ---- Language (UI preference) ---------------------------------------
    /**
     * Read the cached language. i18n.js still reads from localStorage
     * synchronously; this is the preferred API for anything that can wait
     * on `ready()` first (like the Settings picker).
     */
    getLanguage() {
      if (cache.profile && cache.profile.language) return cache.profile.language;
      // Fall back to localStorage so pre-login pages (LoginPage, SignUp)
      // still remember the last choice.
      try { return localStorage.getItem(LANGUAGE_LOCAL_KEY) || "English"; }
      catch (_) { return "English"; }
    },

    /**
     * Persist a new language for the logged-in user. Writes to localStorage
     * immediately (for the synchronous i18n layer to pick up on the next
     * render) and in parallel POSTs to save_language.php so the preference
     * follows the account across devices.
     */
    async saveLanguage(language) {
      const lang = String(language || "").trim() || "English";
      // Mirror to localStorage first so i18n.js sees the new value even if
      // the network call is slow (or the page reloads before it returns).
      try { localStorage.setItem(LANGUAGE_LOCAL_KEY, lang); } catch (_) {}
      if (cache.profile) cache.profile.language = lang;
      if (!cache.user) return lang; // Pre-login: localStorage-only.
      const json = await postJson("save_language.php", { language: lang });
      const saved = (json && json.language) || lang;
      if (cache.profile) cache.profile.language = saved;
      syncLanguageToLocalStorage();
      return saved;
    },

    // ---- Scans ----------------------------------------------------------
    /** Defensive copy of the newest-first scan list. */
    getCurrentScans() {
      return (cache.scans || []).slice();
    },

    async addCurrentScan(scan) {
      if (!cache.user) throw new Error("Not logged in.");
      const payload = {
        productName: String((scan && scan.productName) || "Scanned Product"),
        brandName:   String((scan && scan.brandName)   || ""),
        status:      String((scan && scan.status)      || "Safe"),
        category:    String((scan && scan.category)    || ""),
        note:        String((scan && scan.note)        || ""),
        savedToSafe: !!(scan && scan.savedToSafe),
        thumbnail:   String((scan && scan.thumbnail)   || ""),
        ocrText:     String((scan && scan.ocrText)     || ""),
        timestamp:   Number((scan && scan.timestamp)   || Date.now())
      };
      const json = await postJson("save_scan.php", payload);
      const saved = json && json.scan;
      if (saved) {
        // newest-first to match the server's ORDER BY client_scanned_at DESC.
        cache.scans = [saved].concat(cache.scans || []);
      }
      return saved;
    },

    /**
     * Partial-update an existing scan. `patch` is a subset of the editable
     * fields (see update_scan.php's whitelist). Returns the full updated
     * record, which also replaces the cached copy.
     */
    async updateCurrentScan(id, patch) {
      if (!cache.user) throw new Error("Not logged in.");
      if (!id) throw new Error("Scan id is required.");
      const json = await postJson("update_scan.php", {
        id: String(id),
        patch: patch || {}
      });
      const updated = json && json.scan;
      if (updated) {
        cache.scans = (cache.scans || []).map((s) =>
          String(s.id) === String(updated.id) ? updated : s
        );
      }
      return updated;
    },

    /** Remove one scan owned by the current user. */
    async deleteCurrentScan(id) {
      if (!cache.user) throw new Error("Not logged in.");
      if (!id) throw new Error("Scan id is required.");
      await postJson("delete_scan.php", { id: String(id) });
      cache.scans = (cache.scans || []).filter((s) => String(s.id) !== String(id));
      return true;
    },

    /** Delete the logged-in account entirely and clear the local cache. */
    async deleteCurrentAccount() {
      if (!cache.user) return false;
      await postJson("delete_account.php", {});
      applySnapshot(null);
      readyPromise = Promise.resolve();
      return true;
    }
  };

  // Expose on window so the plain <script> tags in each page can reach it
  // without a module loader.
  window.profileStorage = api;
})();