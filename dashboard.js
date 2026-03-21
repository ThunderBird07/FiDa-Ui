(function bootstrapDashboardPage() {
  const elements = {
    refreshBtn: document.getElementById("refreshBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    backendBadge: document.getElementById("backendBadge"),
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

  if (!elements.refreshBtn || !elements.logoutBtn) {
    return;
  }

  function setAuthStatus(message, isError) {
    elements.authMessage.textContent = message;
    elements.authMessage.classList.toggle("status-error", Boolean(isError));
    elements.authMessage.classList.toggle("status-ok", !isError);
  }

  function setConnectionStatus(connected, message) {
    elements.connectionText.textContent = connected ? "Connected" : "Disconnected";
    elements.connectionDot.classList.toggle("online", connected);
    elements.connectionDot.classList.toggle("offline", !connected);
    elements.statusMessage.textContent = message;
  }

  function getTxnDate(txn) {
    return txn.occurred_at || txn.transaction_date || txn.date || txn.created_at || null;
  }

  function getTxnAmount(txn) {
    const amount = Number(txn.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
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
    elements.incomeValue.textContent = window.FiDaCommon.formatMoney(summary.income);
    elements.expenseValue.textContent = window.FiDaCommon.formatMoney(summary.expense);
    elements.netValue.textContent = window.FiDaCommon.formatMoney(summary.net);
    elements.txnCountValue.textContent = String(summary.count);
  }

  function mapCategories(categories) {
    const map = {};
    for (const category of categories || []) {
      const key = String(category.id || "");
      if (key) {
        map[key] = category;
      }
    }
    return map;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
        return { name, value };
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
            <span class="bar-value">${window.FiDaCommon.formatMoney(row.value)}</span>
          </div>
        `;
      })
      .join("");
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
            <td class="text-end fw-semibold">${window.FiDaCommon.formatMoney(getTxnAmount(txn))}</td>
          </tr>
        `;
      })
      .join("");
  }

  function getDisplayName(profile) {
    return profile?.full_name || profile?.email || "FiDa User";
  }

  async function ensureAuthenticated() {
    try {
      const token = await window.FiDaCommon.getRequiredSessionToken();
      setAuthStatus("Authenticated session active.", false);
      return token;
    } catch {
      window.location.replace("login.html");
      return "";
    }
  }

  async function loadDashboard() {
    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    elements.refreshBtn.disabled = true;
    setConnectionStatus(false, "Fetching dashboard data...");

    try {
      const [profile, categories, transactions] = await Promise.all([
        window.FiDaCommon.fetchJson("/v1/profile", token),
        window.FiDaCommon.fetchJson("/v1/categories", token),
        window.FiDaCommon.fetchJson("/v1/transactions", token)
      ]);

      const categoriesById = mapCategories(categories);
      const txns = Array.isArray(transactions) ? transactions : [];

      renderCards(calculateMonthlySummary(txns));
      renderCategoryBars(txns, categoriesById);
      renderTransactions(txns, categoriesById);
      elements.profileBadge.textContent = getDisplayName(profile);
      setConnectionStatus(true, "Dashboard loaded successfully.");
    } catch (error) {
      setConnectionStatus(false, error.message || "Unable to load dashboard.");
      setAuthStatus("Could not load data with current session.", true);
    } finally {
      elements.refreshBtn.disabled = false;
    }
  }

  async function handleLogout() {
    elements.logoutBtn.disabled = true;
    try {
      await window.FiDaCommon.signOut();
    } catch {
      // Continue to login even if remote sign-out fails.
    }
    window.location.replace("login.html");
  }

  const config = window.FiDaCommon.getConfig();
  window.FiDaCommon.setBaseUrl(config.baseUrl);
  elements.backendBadge.textContent = config.baseUrl;

  elements.refreshBtn.addEventListener("click", loadDashboard);
  elements.logoutBtn.addEventListener("click", handleLogout);

  loadDashboard();
})();