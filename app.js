const STORAGE_KEYS = {
  baseUrl: "fida.baseUrl",
  token: "fida.accessToken",
  supabaseUrl: "fida.supabaseUrl",
  supabaseAnonKey: "fida.supabaseAnonKey",
  email: "fida.email"
};

const state = {
  profile: null,
  categoriesById: {},
  transactions: [],
  supabaseClient: null,
  sessionToken: null
};

const elements = {
  baseUrlInput: document.getElementById("baseUrlInput"),
  supabaseUrlInput: document.getElementById("supabaseUrlInput"),
  supabaseAnonKeyInput: document.getElementById("supabaseAnonKeyInput"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  tokenInput: document.getElementById("tokenInput"),
  registerBtn: document.getElementById("registerBtn"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  connectBtn: document.getElementById("connectBtn"),
  connectionDot: document.getElementById("connectionDot"),
  connectionText: document.getElementById("connectionText"),
  authMessage: document.getElementById("authMessage"),
  statusMessage: document.getElementById("statusMessage"),
  profileBadge: document.getElementById("profileBadge"),
  incomeValue: document.getElementById("incomeValue"),
  expenseValue: document.getElementById("expenseValue"),
  netValue: document.getElementById("netValue"),
  txnCountValue: document.getElementById("txnCountValue"),
  categoryBars: document.getElementById("categoryBars"),
  transactionsBody: document.getElementById("transactionsBody")
};

function loadSavedConfig() {
  elements.baseUrlInput.value = localStorage.getItem(STORAGE_KEYS.baseUrl) || "http://localhost:8000";
  elements.supabaseUrlInput.value = localStorage.getItem(STORAGE_KEYS.supabaseUrl) || "";
  elements.supabaseAnonKeyInput.value = localStorage.getItem(STORAGE_KEYS.supabaseAnonKey) || "";
  elements.emailInput.value = localStorage.getItem(STORAGE_KEYS.email) || "";
  elements.tokenInput.value = localStorage.getItem(STORAGE_KEYS.token) || "";
}

function setAuthStatus(message) {
  elements.authMessage.textContent = message;
}

function setConnectionStatus(connected, message) {
  elements.connectionText.textContent = connected ? "Connected" : "Disconnected";
  elements.connectionDot.classList.toggle("online", connected);
  elements.connectionDot.classList.toggle("offline", !connected);
  elements.statusMessage.textContent = message;
}

function normalizeBaseUrl(input) {
  return input.replace(/\/+$/, "");
}

function saveAuthConfig() {
  const supabaseUrl = normalizeBaseUrl(elements.supabaseUrlInput.value.trim());
  const supabaseAnonKey = elements.supabaseAnonKeyInput.value.trim();
  const email = elements.emailInput.value.trim();

  localStorage.setItem(STORAGE_KEYS.supabaseUrl, supabaseUrl);
  localStorage.setItem(STORAGE_KEYS.supabaseAnonKey, supabaseAnonKey);
  localStorage.setItem(STORAGE_KEYS.email, email);

  return { supabaseUrl, supabaseAnonKey, email };
}

function getSupabaseFactory() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase library not loaded.");
  }
  return window.supabase;
}

function getOrCreateSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = saveAuthConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and anon key are required.");
  }

  if (state.supabaseClient && state.supabaseClient._fidaUrl === supabaseUrl) {
    return state.supabaseClient;
  }

  const supabase = getSupabaseFactory();
  const client = supabase.createClient(supabaseUrl, supabaseAnonKey);
  client._fidaUrl = supabaseUrl;
  state.supabaseClient = client;
  return client;
}

function getUserPassword() {
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value.trim();

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  return { email, password };
}

async function refreshSessionToken() {
  const manualToken = elements.tokenInput.value.trim();
  if (manualToken) {
    state.sessionToken = manualToken;
    localStorage.setItem(STORAGE_KEYS.token, manualToken);
    setAuthStatus("Using manual access token override.");
    return manualToken;
  }

  if (!state.supabaseClient) {
    getOrCreateSupabaseClient();
  }

  const { data, error } = await state.supabaseClient.auth.getSession();
  if (error) {
    throw new Error(error.message || "Unable to read Supabase session.");
  }

  const token = data?.session?.access_token || "";
  if (!token) {
    throw new Error("No active session. Please login first.");
  }

  state.sessionToken = token;
  localStorage.setItem(STORAGE_KEYS.token, token);
  return token;
}

async function registerUser() {
  try {
    elements.registerBtn.disabled = true;
    const client = getOrCreateSupabaseClient();
    const { email, password } = getUserPassword();

    const { error } = await client.auth.signUp({ email, password });
    if (error) {
      throw new Error(error.message || "Registration failed.");
    }

    setAuthStatus("Registration submitted. Check your email if confirmation is enabled.");
  } catch (error) {
    setAuthStatus(error.message || "Registration failed.");
  } finally {
    elements.registerBtn.disabled = false;
  }
}

async function loginUser() {
  try {
    elements.loginBtn.disabled = true;
    const client = getOrCreateSupabaseClient();
    const { email, password } = getUserPassword();

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message || "Login failed.");
    }

    const token = data?.session?.access_token;
    if (!token) {
      throw new Error("Login succeeded but no access token was returned.");
    }

    state.sessionToken = token;
    localStorage.setItem(STORAGE_KEYS.token, token);
    setAuthStatus("Login successful. You can now load the dashboard.");
  } catch (error) {
    setAuthStatus(error.message || "Login failed.");
  } finally {
    elements.loginBtn.disabled = false;
  }
}

async function logoutUser() {
  try {
    elements.logoutBtn.disabled = true;
    if (!state.supabaseClient) {
      getOrCreateSupabaseClient();
    }

    const { error } = await state.supabaseClient.auth.signOut();
    if (error) {
      throw new Error(error.message || "Logout failed.");
    }

    state.sessionToken = null;
    localStorage.removeItem(STORAGE_KEYS.token);
    elements.tokenInput.value = "";
    setAuthStatus("Logged out.");
    setConnectionStatus(false, "Session ended. Login again to load dashboard data.");
  } catch (error) {
    setAuthStatus(error.message || "Logout failed.");
  } finally {
    elements.logoutBtn.disabled = false;
  }
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

function getTxnDate(txn) {
  return txn.transaction_date || txn.occurred_on || txn.date || txn.created_at || null;
}

function getTxnAmount(txn) {
  const amount = Number(txn.amount || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function isCurrentMonth(dateString) {
  if (!dateString) {
    return false;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function calculateMonthlySummary(transactions) {
  let income = 0;
  let expense = 0;
  let count = 0;

  for (const txn of transactions) {
    if (!isCurrentMonth(getTxnDate(txn))) {
      continue;
    }

    count += 1;
    const amount = getTxnAmount(txn);
    const type = String(txn.type || "").toLowerCase();

    if (type === "income") {
      income += amount;
    } else if (type === "expense") {
      expense += amount;
    }
  }

  return {
    income,
    expense,
    net: income - expense,
    count
  };
}

function renderCards(summary) {
  elements.incomeValue.textContent = formatMoney(summary.income);
  elements.expenseValue.textContent = formatMoney(summary.expense);
  elements.netValue.textContent = formatMoney(summary.net);
  elements.txnCountValue.textContent = String(summary.count);
}

function renderCategoryBars(transactions, categoriesById) {
  const totals = {};

  for (const txn of transactions) {
    if (!isCurrentMonth(getTxnDate(txn))) {
      continue;
    }
    if (String(txn.type || "").toLowerCase() !== "expense") {
      continue;
    }

    const categoryId = txn.category_id || "uncategorized";
    const key = String(categoryId);
    totals[key] = (totals[key] || 0) + getTxnAmount(txn);
  }

  const rows = Object.entries(totals)
    .map(([categoryId, value]) => {
      const category = categoriesById[categoryId];
      const name = category?.name || "Uncategorized";
      return { categoryId, name, value };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (rows.length === 0) {
    elements.categoryBars.innerHTML = "<p class=\"text-body-secondary mb-0\">No expense data this month.</p>";
    return;
  }

  const max = rows[0].value || 1;
  elements.categoryBars.innerHTML = rows
    .map((row) => {
      const width = Math.max(6, Math.round((row.value / max) * 100));
      return `
        <div class="bar-row">
          <span class="bar-label" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <span class="bar-value">${formatMoney(row.value)}</span>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTransactions(transactions, categoriesById) {
  const rows = [...transactions]
    .sort((a, b) => {
      const aDate = new Date(getTxnDate(a) || 0).getTime();
      const bDate = new Date(getTxnDate(b) || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 10);

  if (rows.length === 0) {
    elements.transactionsBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-body-secondary py-4">No transactions found.</td>
      </tr>
    `;
    return;
  }

  elements.transactionsBody.innerHTML = rows
    .map((txn) => {
      const rawType = String(txn.type || "unknown").toLowerCase();
      const categoryName = categoriesById[String(txn.category_id)]?.name || "Uncategorized";
      const dateValue = getTxnDate(txn);
      const dateText = dateValue ? new Date(dateValue).toLocaleDateString() : "-";
      return `
        <tr>
          <td>${escapeHtml(dateText)}</td>
          <td>${escapeHtml(categoryName)}</td>
          <td><span class="txn-type ${escapeHtml(rawType)}">${escapeHtml(rawType)}</span></td>
          <td class="text-end fw-semibold">${formatMoney(getTxnAmount(txn))}</td>
        </tr>
      `;
    })
    .join("");
}

async function fetchJson(baseUrl, token, path) {
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

function mapCategories(categories) {
  const map = {};
  for (const item of categories || []) {
    const key = String(item.id || "");
    if (key) {
      map[key] = item;
    }
  }
  return map;
}

function getDisplayName(profile) {
  if (!profile) {
    return "";
  }
  return profile.full_name || profile.display_name || profile.email || "FiDa User";
}

async function connectAndLoad() {
  const baseUrl = normalizeBaseUrl(elements.baseUrlInput.value.trim());
  let token = elements.tokenInput.value.trim();

  if (!baseUrl) {
    setConnectionStatus(false, "Please provide backend URL.");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl);
  saveAuthConfig();

  elements.connectBtn.disabled = true;
  setConnectionStatus(false, "Connecting and fetching dashboard data...");

  try {
    token = token || (await refreshSessionToken());

    const [profile, categories, transactions] = await Promise.all([
      fetchJson(baseUrl, token, "/v1/profile"),
      fetchJson(baseUrl, token, "/v1/categories"),
      fetchJson(baseUrl, token, "/v1/transactions")
    ]);

    state.profile = profile;
    state.categoriesById = mapCategories(categories);
    state.transactions = Array.isArray(transactions) ? transactions : [];

    const summary = calculateMonthlySummary(state.transactions);
    renderCards(summary);
    renderCategoryBars(state.transactions, state.categoriesById);
    renderTransactions(state.transactions, state.categoriesById);
    elements.profileBadge.textContent = getDisplayName(profile);

    setConnectionStatus(true, "Dashboard loaded successfully.");
    setAuthStatus("Authenticated session is active.");
  } catch (error) {
    setConnectionStatus(false, error.message || "Unable to load data.");
  } finally {
    elements.connectBtn.disabled = false;
  }
}

elements.registerBtn.addEventListener("click", registerUser);
elements.loginBtn.addEventListener("click", loginUser);
elements.logoutBtn.addEventListener("click", logoutUser);
elements.connectBtn.addEventListener("click", connectAndLoad);
loadSavedConfig();

(async function hydrateAuthState() {
  try {
    if (elements.tokenInput.value.trim()) {
      setAuthStatus("Manual token loaded from local storage.");
      return;
    }

    const client = getOrCreateSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) {
      throw error;
    }

    const token = data?.session?.access_token;
    if (token) {
      state.sessionToken = token;
      localStorage.setItem(STORAGE_KEYS.token, token);
      setAuthStatus("Session restored from Supabase.");
    } else {
      setAuthStatus("Not authenticated.");
    }
  } catch {
    setAuthStatus("Add Supabase URL and anon key, then login or register.");
  }
})();