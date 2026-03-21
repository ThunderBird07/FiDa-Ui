(function bootstrapFiDaCommon() {
  const STORAGE_KEYS = {
    baseUrl: "fida.baseUrl",
    token: "fida.accessToken",
    email: "fida.email"
  };

  const DEFAULTS = {
    baseUrl: "fida.local",
    supabaseUrl: "https://zxhblkjnribrpbgdpikj.supabase.co",
    supabaseAnonKey: "sb_publishable_ohgA85jyVMVMoU3fEhOhbA_ifiwZtp8"
  };

  function normalizeBaseUrl(input) {
    const raw = String(input || "").trim();
    if (!raw) {
      return "";
    }

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return withProtocol.replace(/\/+$/, "");
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
  }

  function authHeaders(token) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
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

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value);
  }

  window.FiDaCommon = {
    STORAGE_KEYS,
    DEFAULTS,
    normalizeBaseUrl,
    getConfig,
    getEmail,
    setEmail,
    setBaseUrl,
    getSupabaseClient,
    getSessionToken,
    getRequiredSessionToken,
    signOut,
    fetchJson,
    formatMoney
  };
})();