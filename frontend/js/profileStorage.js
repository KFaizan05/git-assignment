// Shared helper for per-user account storage.
// Backed by Firebase Authentication + Firestore.
(function initProfileStorage() {
  "use strict";

  const LANGUAGE_LOCAL_KEY = "labelwiseLanguage";
  const FIREBASE_SDK_VERSION = "10.12.5";
  const FIREBASE_CONFIG =
    window.__LABELWISE_FIREBASE_CONFIG__ ||
    window.FIREBASE_CONFIG ||
    null;

  const EMPTY_PROFILE = Object.freeze({
    name: "",
    language: "English",
    dietary: [],
    allergens: [],
    customAllergens: []
  });

  let cache = {
    user: null,
    isGuest: false,
    profile: null,
    scans: []
  };

  let firebaseReadyPromise = null;
  let readyPromise = null;
  let authStateReadyPromise = null;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function syncLanguageToLocalStorage() {
    try {
      const lang = (cache.profile && cache.profile.language) || "English";
      localStorage.setItem(LANGUAGE_LOCAL_KEY, lang);
    } catch (_) {}
  }

  function safeArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function toScanRecord(id, data) {
    return {
      id: String(id),
      productName: String(data.productName || "Scanned Product"),
      brandName: String(data.brandName || ""),
      status: String(data.status || "Safe"),
      category: String(data.category || ""),
      note: String(data.note || ""),
      savedToSafe: !!data.savedToSafe,
      thumbnail: String(data.thumbnail || ""),
      ocrText: String(data.ocrText || ""),
      timestamp: Number(data.timestamp || Date.now())
    };
  }

  function loadFirebaseScript(path) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-firebase="${path}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load Firebase SDK.")), { once: true });
        if (existing.dataset.loaded === "1") resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/${path}`;
      script.async = true;
      script.dataset.firebase = path;
      script.onload = () => {
        script.dataset.loaded = "1";
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load Firebase SDK."));
      document.head.appendChild(script);
    });
  }

  async function ensureFirebase() {
    if (firebaseReadyPromise) return firebaseReadyPromise;
    firebaseReadyPromise = (async () => {
      await loadFirebaseScript("firebase-app-compat.js");
      await loadFirebaseScript("firebase-auth-compat.js");
      await loadFirebaseScript("firebase-firestore-compat.js");

      if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
        throw new Error(
          "Missing Firebase config. Set window.__LABELWISE_FIREBASE_CONFIG__ before profileStorage.js loads."
        );
      }

      if (!window.firebase || !window.firebase.apps) {
        throw new Error("Firebase SDK unavailable.");
      }

      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }
      return {
        auth: window.firebase.auth(),
        db: window.firebase.firestore()
      };
    })();
    return firebaseReadyPromise;
  }

  function waitForAuthStateReady(auth) {
    if (auth.currentUser) {
      return Promise.resolve(auth.currentUser);
    }
    if (authStateReadyPromise) {
      return authStateReadyPromise;
    }
    authStateReadyPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(auth.currentUser || null);
      }, 2000);
      const unsubscribe = auth.onAuthStateChanged((user) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(user || null);
      });
    }).finally(() => {
      authStateReadyPromise = null;
    });
    return authStateReadyPromise;
  }

  function currentAuthUser(auth) {
    return auth.currentUser || null;
  }

  function getUserLabel(user) {
    if (!user) return null;
    if (user.email) return String(user.email).toLowerCase();
    return `guest-${user.uid}@labelwise.local`;
  }

  async function ensureUserDocs(db, user) {
    const userRef = db.collection("users").doc(user.uid);
    const profileRef = userRef.collection("profile").doc("main");
    const userEmailLabel = getUserLabel(user) || "";
    const userDisplayName = String((user && user.displayName) || "");
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        email: userEmailLabel,
        name: userDisplayName,
        isGuest: !!user.isAnonymous,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      await userRef.set(
        {
          email: userEmailLabel,
          name: userDisplayName,
          isGuest: !!user.isAnonymous,
          updatedAt: Date.now()
        },
        { merge: true }
      );
    }

    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      await profileRef.set({
        ...EMPTY_PROFILE
      });
    }
  }

  async function loadSnapshot() {
    const { auth, db } = await ensureFirebase();
    const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
    if (!user) {
      cache = { user: null, isGuest: false, profile: null, scans: [] };
      return;
    }

    await ensureUserDocs(db, user);
    const userRef = db.collection("users").doc(user.uid);
    const profileSnap = await userRef.collection("profile").doc("main").get();
    const scansSnap = await userRef.collection("scans").orderBy("timestamp", "desc").get();

    const profileData = profileSnap.exists ? profileSnap.data() : EMPTY_PROFILE;
    cache = {
      user: getUserLabel(user),
      isGuest: !!user.isAnonymous,
      profile: {
        name: String(profileData.name || ""),
        language: String(profileData.language || "English"),
        dietary: safeArray(profileData.dietary),
        allergens: safeArray(profileData.allergens),
        customAllergens: safeArray(profileData.customAllergens)
      },
      scans: scansSnap.docs.map((doc) => toScanRecord(doc.id, doc.data()))
    };
    syncLanguageToLocalStorage();
  }

  function mapAuthError(err) {
    const code = err && err.code ? String(err.code) : "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return new Error("Incorrect email or password.");
    }
    if (code === "auth/email-already-in-use") {
      return new Error("An account with that email already exists.");
    }
    if (code === "auth/weak-password") {
      return new Error("Password is too weak.");
    }
    if (code === "auth/invalid-email") {
      return new Error("Please enter a valid email address.");
    }
    return new Error((err && err.message) || "Authentication failed.");
  }

  async function deleteUserData(db, uid) {
    const userRef = db.collection("users").doc(uid);
    const scans = await userRef.collection("scans").get();
    for (const doc of scans.docs) {
      await doc.ref.delete();
    }
    await userRef.collection("profile").doc("main").delete().catch(() => {});
    await userRef.delete().catch(() => {});
  }

  const api = {
    async ready() {
      if (!readyPromise) {
        readyPromise = loadSnapshot().catch((err) => {
          console.warn("profileStorage: hydration failed –", err && err.message);
          cache = { user: null, isGuest: false, profile: null, scans: [] };
        });
      }
      return readyPromise;
    },

    refresh() {
      readyPromise = null;
      return api.ready();
    },

    getCurrentUser() {
      return cache.user;
    },

    isGuestAccount() {
      return cache.isGuest;
    },

    async login(email, password) {
      try {
        const { auth } = await ensureFirebase();
        await auth.signInWithEmailAndPassword(
          normalizeEmail(email),
          String(password == null ? "" : password)
        );
        await loadSnapshot();
        readyPromise = Promise.resolve();
        return true;
      } catch (err) {
        throw mapAuthError(err);
      }
    },

    async loginWithGoogle() {
      try {
        const { auth, db } = await ensureFirebase();
        const provider = new window.firebase.auth.GoogleAuthProvider();
        const cred = await auth.signInWithPopup(provider);
        if (cred && cred.user) {
          await ensureUserDocs(db, cred.user);
        }
        await loadSnapshot();
        readyPromise = Promise.resolve();
        return true;
      } catch (err) {
        if (err && err.code === "auth/popup-closed-by-user") {
          throw new Error("Google sign-in was cancelled.");
        }
        throw mapAuthError(err);
      }
    },

    async signup(email, password) {
      try {
        const { auth, db } = await ensureFirebase();
        const cred = await auth.createUserWithEmailAndPassword(
          normalizeEmail(email),
          String(password == null ? "" : password)
        );
        await ensureUserDocs(db, cred.user);
        await loadSnapshot();
        readyPromise = Promise.resolve();
        return true;
      } catch (err) {
        throw mapAuthError(err);
      }
    },

    async quickstart() {
      const { auth, db } = await ensureFirebase();
      const cred = await auth.signInAnonymously();
      await ensureUserDocs(db, cred.user);
      await loadSnapshot();
      readyPromise = Promise.resolve();
      return cache.user;
    },

    async logout() {
      const { auth, db } = await ensureFirebase();
      const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
      if (user && user.isAnonymous) {
        await deleteUserData(db, user.uid);
      }
      await auth.signOut();
      cache = { user: null, isGuest: false, profile: null, scans: [] };
      readyPromise = Promise.resolve();
    },

    getCurrentProfile() {
      if (!cache.profile) return { ...EMPTY_PROFILE };
      return {
        name: cache.profile.name || "",
        language: cache.profile.language || "English",
        dietary: safeArray(cache.profile.dietary),
        allergens: safeArray(cache.profile.allergens),
        customAllergens: safeArray(cache.profile.customAllergens)
      };
    },

    async saveCurrentProfile(profile) {
      if (!cache.user) return false;
      const { auth, db } = await ensureFirebase();
      const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
      if (!user) return false;

      const payload = {
        name: String((profile && profile.name) || ""),
        dietary: safeArray(profile && profile.dietary),
        allergens: safeArray(profile && profile.allergens),
        customAllergens: safeArray(profile && profile.customAllergens)
          .map((s) => String(s || "").trim())
          .filter(Boolean),
        language: (cache.profile && cache.profile.language) || "English"
      };
      await db.collection("users").doc(user.uid).collection("profile").doc("main").set(payload, { merge: true });
      await db.collection("users").doc(user.uid).set(
        {
          name: payload.name || "",
          email: getUserLabel(user) || "",
          updatedAt: Date.now()
        },
        { merge: true }
      );
      cache.profile = { ...payload };
      syncLanguageToLocalStorage();
      return true;
    },

    getLanguage() {
      if (cache.profile && cache.profile.language) return cache.profile.language;
      try {
        return localStorage.getItem(LANGUAGE_LOCAL_KEY) || "English";
      } catch (_) {
        return "English";
      }
    },

    async saveLanguage(language) {
      const lang = String(language || "").trim() || "English";
      try {
        localStorage.setItem(LANGUAGE_LOCAL_KEY, lang);
      } catch (_) {}
      if (cache.profile) cache.profile.language = lang;
      if (!cache.user) return lang;

      const { auth, db } = await ensureFirebase();
      const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
      if (!user) return lang;
      await db.collection("users").doc(user.uid).collection("profile").doc("main").set(
        { language: lang },
        { merge: true }
      );
      if (cache.profile) cache.profile.language = lang;
      syncLanguageToLocalStorage();
      return lang;
    },

    getCurrentScans() {
      return safeArray(cache.scans);
    },

    async addCurrentScan(scan) {
      if (!cache.user) throw new Error("Not logged in.");
      const { auth, db } = await ensureFirebase();
      const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
      if (!user) throw new Error("Not logged in.");

      const payload = {
        productName: String((scan && scan.productName) || "Scanned Product"),
        brandName: String((scan && scan.brandName) || ""),
        status: String((scan && scan.status) || "Safe"),
        category: String((scan && scan.category) || ""),
        note: String((scan && scan.note) || ""),
        savedToSafe: !!(scan && scan.savedToSafe),
        thumbnail: String((scan && scan.thumbnail) || ""),
        ocrText: String((scan && scan.ocrText) || ""),
        timestamp: Number((scan && scan.timestamp) || Date.now())
      };
      const ref = await db.collection("users").doc(user.uid).collection("scans").add(payload);
      const saved = toScanRecord(ref.id, payload);
      cache.scans = [saved].concat(cache.scans || []);
      return saved;
    },

    async updateCurrentScan(id, patch) {
      if (!cache.user) throw new Error("Not logged in.");
      if (!id) throw new Error("Scan id is required.");
      const { auth, db } = await ensureFirebase();
      const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
      if (!user) throw new Error("Not logged in.");

      const cleanPatch = Object.assign({}, patch || {});
      await db.collection("users").doc(user.uid).collection("scans").doc(String(id)).set(cleanPatch, { merge: true });
      const idx = (cache.scans || []).findIndex((s) => String(s.id) === String(id));
      if (idx !== -1) {
        const merged = { ...cache.scans[idx], ...cleanPatch, id: String(id) };
        cache.scans[idx] = toScanRecord(id, merged);
      }
      return (cache.scans || []).find((s) => String(s.id) === String(id)) || null;
    },

    async deleteCurrentScan(id) {
      if (!cache.user) throw new Error("Not logged in.");
      if (!id) throw new Error("Scan id is required.");
      const { auth, db } = await ensureFirebase();
      const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
      if (!user) throw new Error("Not logged in.");

      await db.collection("users").doc(user.uid).collection("scans").doc(String(id)).delete();
      cache.scans = (cache.scans || []).filter((s) => String(s.id) !== String(id));
      return true;
    },

    async deleteCurrentAccount() {
      if (!cache.user) return false;
      const { auth, db } = await ensureFirebase();
      const user = (await waitForAuthStateReady(auth)) || currentAuthUser(auth);
      if (!user) return false;

      await deleteUserData(db, user.uid);
      await user.delete();
      cache = { user: null, isGuest: false, profile: null, scans: [] };
      readyPromise = Promise.resolve();
      return true;
    }
  };

  window.profileStorage = api;
})();