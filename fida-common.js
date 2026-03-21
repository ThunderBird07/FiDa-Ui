(function bootstrapFiDaCommon() {
  const STORAGE_KEYS = {
    baseUrl: "fida.baseUrl",
    token: "fida.accessToken",
    email: "fida.email",
    dashboardSettings: "fida.dashboardSettings",
    sessionDek: "fida.sessionDek",
    upcomingBills: "fida.upcomingBills",
    planningGoals: "fida.planningGoals"
  };
  const DEFAULT_DASHBOARD_SETTINGS = {
    schema_version: 1,
    active_theme: "midnight",
    locale: "en-IN",
    currency: "INR",
    modules: {
      cashflow_summary: { enabled: true },
      spending_by_category: { enabled: true },
      account_balances: { enabled: true },
      monthly_trend: { enabled: true },
      budget_usage: { enabled: true },
      recent_transactions: { enabled: true }
    }
  };


  const DEFAULTS = {
    baseUrl: "172.28.46.25",
    supabaseUrl: "https://zxhblkjnribrpbgdpikj.supabase.co",
    supabaseAnonKey: "sb_publishable_ohgA85jyVMVMoU3fEhOhbA_ifiwZtp8"
  };
  const CRYPTO_DEFAULTS = {
    version: 1,
    pbkdf2Iterations: 210000,
    pbkdf2Hash: "SHA-256",
    saltBytes: 16,
    nonceBytes: 12
  };

  function normalizeBaseUrl(input) {
    const raw = String(input || "").trim();
    if (!raw) {
      return "";
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const trimmed = withProtocol.replace(/\/+$/, "");

    try {
      const url = new URL(trimmed);
      if (url.hostname.toLowerCase() === "fida.local" && !url.port) {
        url.port = "8000";
      }
      return url.toString().replace(/\/+$/, "");
    } catch {
      return trimmed;
    }
  }

  function getConfig() {
    return {
      baseUrl: normalizeBaseUrl(localStorage.getItem(STORAGE_KEYS.baseUrl) || DEFAULTS.baseUrl),
      supabaseUrl: DEFAULTS.supabaseUrl,
      supabaseAnonKey: DEFAULTS.supabaseAnonKey
    };
  }

  function getEmail() {
    return localStorage.getItem(STORAGE_KEYS.email) || "";
  }

  function setEmail(email) {
    localStorage.setItem(STORAGE_KEYS.email, String(email || ""));
  }

  function setBaseUrl(baseUrl) {
    const normalized = normalizeBaseUrl(baseUrl || DEFAULTS.baseUrl);
    localStorage.setItem(STORAGE_KEYS.baseUrl, normalized);
    return normalized;
  }

  function getSupabaseFactory() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase library did not load.");
    }
    return window.supabase;
  }

  function getSupabaseClient() {
    const config = getConfig();

    if (window.__fidaSupabaseClient && window.__fidaSupabaseClient._fidaUrl === config.supabaseUrl) {
      return window.__fidaSupabaseClient;
    }

    const supabase = getSupabaseFactory();
    const client = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    client._fidaUrl = config.supabaseUrl;
    window.__fidaSupabaseClient = client;
    return client;
  }

  async function getSessionToken() {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw new Error(error.message || "Unable to get Supabase session.");
    }

    const token = data?.session?.access_token || "";
    if (token) {
      localStorage.setItem(STORAGE_KEYS.token, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.token);
    }

    return token;
  }

  async function getRequiredSessionToken() {
    const token = await getSessionToken();
    if (!token) {
      throw new Error("No active session. Please login first.");
    }
    return token;
  }

  async function signOut() {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error(error.message || "Logout failed.");
    }
    localStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.sessionDek);
  }

  function authHeaders(token) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function deriveKekFromPassword(password, saltBytes) {
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: CRYPTO_DEFAULTS.pbkdf2Iterations,
        hash: CRYPTO_DEFAULTS.pbkdf2Hash
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function storeSessionDek(dekKey) {
    const raw = await crypto.subtle.exportKey("raw", dekKey);
    sessionStorage.setItem(STORAGE_KEYS.sessionDek, bytesToBase64(new Uint8Array(raw)));
  }

  async function getSessionDek() {
    const rawBase64 = sessionStorage.getItem(STORAGE_KEYS.sessionDek);
    if (!rawBase64) {
      return null;
    }

    const rawBytes = base64ToBytes(rawBase64);
    return crypto.subtle.importKey("raw", rawBytes, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  }

  async function setupProfileEncryption(token, password) {
    const salt = crypto.getRandomValues(new Uint8Array(CRYPTO_DEFAULTS.saltBytes));
    const kek = await deriveKekFromPassword(password, salt);
    const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

    const dekRaw = await crypto.subtle.exportKey("raw", dek);
    const wrapNonce = crypto.getRandomValues(new Uint8Array(CRYPTO_DEFAULTS.nonceBytes));
    const wrappedDekRaw = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: wrapNonce },
      kek,
      dekRaw
    );

    const { baseUrl } = getConfig();
    const response = await fetch(`${baseUrl}/v1/profile`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        encryption_salt: bytesToBase64(salt),
        wrapped_dek: bytesToBase64(new Uint8Array(wrappedDekRaw)),
        wrapped_dek_nonce: bytesToBase64(wrapNonce),
        encryption_version: CRYPTO_DEFAULTS.version
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Could not initialize encryption (${response.status}): ${errText || response.statusText}`);
    }

    await storeSessionDek(dek);
  }

  async function unlockProfileEncryption(password, profile) {
    if (!profile?.encryption_salt || !profile?.wrapped_dek || !profile?.wrapped_dek_nonce) {
      throw new Error("Profile encryption key material is missing.");
    }

    const salt = base64ToBytes(profile.encryption_salt);
    const wrappedDek = base64ToBytes(profile.wrapped_dek);
    const wrapNonce = base64ToBytes(profile.wrapped_dek_nonce);
    const kek = await deriveKekFromPassword(password, salt);

    let dekRaw;
    try {
      dekRaw = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: wrapNonce },
        kek,
        wrappedDek
      );
    } catch {
      throw new Error("Could not unlock encrypted data. Password may be incorrect.");
    }

    const dek = await crypto.subtle.importKey("raw", dekRaw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    await storeSessionDek(dek);
  }

  async function initializeEncryptionForSession(token, password) {
    if (!token || !password) {
      throw new Error("Token and password are required to initialize encryption.");
    }

    const profile = await fetchJson("/v1/profile", token);
    const hasKeyMaterial = Boolean(profile?.encryption_salt && profile?.wrapped_dek && profile?.wrapped_dek_nonce);
    if (!hasKeyMaterial) {
      await setupProfileEncryption(token, password);
      return;
    }

    await unlockProfileEncryption(password, profile);
  }

  async function rewrapProfileEncryptionForNewPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw new Error("Token and new password are required to re-wrap encryption keys.");
    }

    const dek = await getSessionDek();
    if (!dek) {
      throw new Error("No unlocked encryption key in session. Please login again first.");
    }

    const salt = crypto.getRandomValues(new Uint8Array(CRYPTO_DEFAULTS.saltBytes));
    const kek = await deriveKekFromPassword(newPassword, salt);
    const dekRaw = await crypto.subtle.exportKey("raw", dek);
    const wrapNonce = crypto.getRandomValues(new Uint8Array(CRYPTO_DEFAULTS.nonceBytes));
    const wrappedDekRaw = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: wrapNonce },
      kek,
      dekRaw
    );

    const { baseUrl } = getConfig();
    const response = await fetch(`${baseUrl}/v1/profile`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        encryption_salt: bytesToBase64(salt),
        wrapped_dek: bytesToBase64(new Uint8Array(wrappedDekRaw)),
        wrapped_dek_nonce: bytesToBase64(wrapNonce),
        encryption_version: CRYPTO_DEFAULTS.version
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Could not re-wrap encryption keys (${response.status}): ${errText || response.statusText}`);
    }
  }

  async function encryptJsonForStorage(value) {
    const dek = await getSessionDek();
    if (!dek) {
      throw new Error("No unlocked encryption key in session.");
    }

    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const nonce = crypto.getRandomValues(new Uint8Array(CRYPTO_DEFAULTS.nonceBytes));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      dek,
      plaintext
    );

    return {
      encryption_version: CRYPTO_DEFAULTS.version,
      encryption_nonce: bytesToBase64(nonce),
      encrypted_blob: bytesToBase64(new Uint8Array(ciphertext))
    };
  }

  async function decryptJsonFromStorage(encryptedBlob, encryptionNonce) {
    if (!encryptedBlob || !encryptionNonce) {
      throw new Error("Encrypted payload and nonce are required.");
    }

    const dek = await getSessionDek();
    if (!dek) {
      throw new Error("No unlocked encryption key in session.");
    }

    const nonce = base64ToBytes(encryptionNonce);
    const ciphertext = base64ToBytes(encryptedBlob);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      dek,
      ciphertext
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  async function fetchJson(path, token) {
    const { baseUrl } = getConfig();
    if (!baseUrl) {
      throw new Error("Backend URL is not configured.");
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: authHeaders(token)
    });

    if (!response.ok) {
      const fallbackText = await response.text();
      throw new Error(`${path} failed (${response.status}): ${fallbackText || response.statusText}`);
    }

    return response.json();
  }

  function formatMoney(value, locale, currency) {
    const resolvedLocale = locale || "en-IN";
    const resolvedCurrency = (currency || "INR").toUpperCase();
    return new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency: resolvedCurrency,
      maximumFractionDigits: 2
    }).format(value);
  }

  function mergeDashboardSettings(raw) {
    const merged = structuredClone(DEFAULT_DASHBOARD_SETTINGS);
    if (!raw || typeof raw !== "object") {
      return merged;
    }

    merged.active_theme = raw.active_theme || merged.active_theme;
    merged.locale = raw.locale || merged.locale;
    merged.currency = raw.currency || merged.currency;

    if (raw.modules && typeof raw.modules === "object") {
      for (const moduleId of Object.keys(merged.modules)) {
        if (raw.modules[moduleId] && typeof raw.modules[moduleId] === "object") {
          merged.modules[moduleId].enabled = raw.modules[moduleId].enabled !== false;
        }
      }
    }

    return merged;
  }

  function getDashboardSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.dashboardSettings);
      return mergeDashboardSettings(raw ? JSON.parse(raw) : null);
    } catch {
      return structuredClone(DEFAULT_DASHBOARD_SETTINGS);
    }
  }

  function saveDashboardSettings(settings) {
    const merged = mergeDashboardSettings(settings);
    localStorage.setItem(STORAGE_KEYS.dashboardSettings, JSON.stringify(merged));
    return merged;
  }

  function getUpcomingBills() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.upcomingBills);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String(item.id || crypto.randomUUID()),
          name: String(item.name || "Untitled bill"),
          amount: Number(item.amount || 0),
          due_date: String(item.due_date || ""),
          frequency: String(item.frequency || "monthly")
        }))
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    } catch {
      return [];
    }
  }

  function saveUpcomingBills(bills) {
    const normalized = Array.isArray(bills) ? bills : [];
    localStorage.setItem(STORAGE_KEYS.upcomingBills, JSON.stringify(normalized));
    return getUpcomingBills();
  }

  function getPlanningGoals() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.planningGoals);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String(item.id || crypto.randomUUID()),
          title: String(item.title || "Untitled goal"),
          target_amount: Number(item.target_amount || 0),
          target_date: String(item.target_date || ""),
          status: String(item.status || "planned")
        }))
        .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());
    } catch {
      return [];
    }
  }

  function savePlanningGoals(goals) {
    const normalized = Array.isArray(goals) ? goals : [];
    localStorage.setItem(STORAGE_KEYS.planningGoals, JSON.stringify(normalized));
    return getPlanningGoals();
  }

  window.FiDaCommon = {
    STORAGE_KEYS,
    DEFAULTS,
    CRYPTO_DEFAULTS,
    normalizeBaseUrl,
    getConfig,
    getEmail,
    setEmail,
    setBaseUrl,
    DEFAULT_DASHBOARD_SETTINGS,
    getDashboardSettings,
    saveDashboardSettings,
    getUpcomingBills,
    saveUpcomingBills,
    getPlanningGoals,
    savePlanningGoals,
    getSupabaseClient,
    getSessionToken,
    getRequiredSessionToken,
    signOut,
    fetchJson,
    formatMoney,
    initializeEncryptionForSession,
    rewrapProfileEncryptionForNewPassword,
    encryptJsonForStorage,
    decryptJsonFromStorage
  };
})();