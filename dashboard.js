(function bootstrapDashboardPage() {
  const settings = window.FiDaCommon.getDashboardSettings();
  let currentUsageMessage = "";

  const elements = {
    dashboardGrid: document.getElementById("dashboardGrid"),
    globalThemeSelect: document.getElementById("globalThemeSelect"),
    logoutBtn: document.getElementById("logoutBtn"),
    welcomeTitle: document.getElementById("welcomeTitle"),
    profileBadge: document.getElementById("profileBadge"),
    incomeValue: document.getElementById("incomeValue"),
    expenseValue: document.getElementById("expenseValue"),
    netValue: document.getElementById("netValue"),
    txnCountValue: document.getElementById("txnCountValue"),
    categoryBars: document.getElementById("categoryBars"),
    accountsSummary: document.getElementById("accountsSummary"),
    trendBars: document.getElementById("trendBars"),
    trendMeta: document.getElementById("trendMeta"),
    budgetUsage: document.getElementById("budgetUsage")
  };

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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatDueDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "No due date";
    }
    return date.toLocaleDateString(settings.locale || "en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function applyThemeAndVisibility() {
    document.body.setAttribute("data-theme", settings.active_theme || "midnight");
    if (elements.globalThemeSelect) {
      elements.globalThemeSelect.value = settings.active_theme || "midnight";
    }
    for (const moduleEl of document.querySelectorAll(".dashboard-module")) {
      moduleEl.classList.remove("hidden-module");
    }

    if (elements.dashboardGrid) {
      elements.dashboardGrid.classList.remove("dashboard-grid-reflow");
    }
  }

  async function maybeDecryptRecords(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return records;
    }

    const output = [];
    for (const item of records) {
      if (!item?.encrypted_blob || !item?.encryption_nonce) {
        output.push(item);
        continue;
      }

      try {
        const decrypted = await window.FiDaCommon.decryptJsonFromStorage(item.encrypted_blob, item.encryption_nonce);
        output.push({ ...item, ...decrypted });
      } catch {
        output.push(item);
      }
    }

    return output;
  }

  function renderCards(transactions, moneyFormatter) {
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
      }
      if (type === "expense") {
        expense += amount;
      }
    }

    const net = income - expense;
    elements.incomeValue.textContent = moneyFormatter(income);
    elements.expenseValue.textContent = moneyFormatter(expense);
    elements.netValue.textContent = moneyFormatter(net);
    elements.txnCountValue.textContent = String(count);

    const usagePercent = income > 0 ? Math.round((expense / income) * 100) : 0;
    currentUsageMessage =
      income > 0
        ? `Current month uses ${usagePercent}% of income as spend.`
        : "Add income and expense records to estimate budget utilization.";

    const bills = window.FiDaCommon.getUpcomingBills();
    const dueThisMonth = window.FiDaCommon.getBillsDueForMonth(bills, transactions, new Date());
    
    // Filter out completed bills
    const activeUpcomingBills = dueThisMonth.filter((item) => item.status !== "completed");

    if (!activeUpcomingBills.length) {
      elements.budgetUsage.innerHTML = `<p class=\"muted-text\">No bills due this month.</p>`;
      return;
    }

    const upcomingRows = activeUpcomingBills
      .slice(0, 4)
      .map((item) => {
        const dueDate = formatDueDate(item.dueDateIso || item.bill?.due_date);
        const statusLabel = item.status === "past_due" ? "Past due" : "Upcoming";
        const statusClass = item.status === "past_due" ? "bill-status-past-due" : "bill-status-upcoming";
        const billName = escapeHtml(item.bill?.name || "Bill");
        return `<div class="account-row"><span>${billName}</span><strong class="bill-status-text ${statusClass}">${escapeHtml(statusLabel)}</strong></div><p class="muted-text bill-due">Due: ${escapeHtml(dueDate)}</p>`;
      })
      .join("");

    elements.budgetUsage.innerHTML = `<div class=\"account-list\">${upcomingRows}</div>`;
  }

  function renderCategoryBars(transactions, categoriesById, moneyFormatter) {
    const totals = {};

    for (const txn of transactions) {
      if (!isCurrentMonth(getTxnDate(txn))) {
        continue;
      }
      if (String(txn.type || "").toLowerCase() !== "expense") {
        continue;
      }

      const key = String(txn.category_id || "uncategorized");
      totals[key] = (totals[key] || 0) + getTxnAmount(txn);
    }

    const rows = Object.entries(totals)
      .map(([id, value]) => ({
        name: categoriesById[id]?.name || "Uncategorized",
        value
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    if (rows.length === 0) {
      elements.categoryBars.innerHTML = "<p class=\"muted-text\">No expense data this month.</p>";
      return;
    }

    const max = rows[0].value || 1;
    elements.categoryBars.innerHTML = rows
      .map((row) => {
        const width = Math.max(8, Math.round((row.value / max) * 100));
        return `
          <div class="bar-row">
            <span class="bar-label">${escapeHtml(row.name)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
            <span class="bar-value">${moneyFormatter(row.value)}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderAccounts(accounts, moneyFormatter) {
    if (!Array.isArray(accounts) || accounts.length === 0) {
      elements.accountsSummary.innerHTML = "<p class=\"muted-text\">No accounts found.</p>";
      return;
    }

    const rows = accounts.slice(0, 5).map((account) => {
      return `<div class=\"account-row\"><span>${escapeHtml(account.name)}</span><strong>${moneyFormatter(getTxnAmount({ amount: account.balance }))}</strong></div>`;
    });

    elements.accountsSummary.innerHTML = rows.join("");
  }

  function renderTrend(transactions, moneyFormatter) {
    const now = new Date();
    const buckets = [];

    for (let i = 5; i >= 0; i -= 1) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${month.getFullYear()}-${month.getMonth()}`;
      buckets.push({
        key,
        label: month.toLocaleDateString(settings.locale || "en-IN", { month: "short" }),
        value: 0
      });
    }

    const byKey = Object.fromEntries(buckets.map((bucket) => [bucket.key, bucket]));

    for (const txn of transactions) {
      const date = new Date(getTxnDate(txn) || "");
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = byKey[key];
      if (!bucket) {
        continue;
      }

      const amount = getTxnAmount(txn);
      const type = String(txn.type || "").toLowerCase();
      bucket.value += type === "expense" ? -amount : amount;
    }

    const max = Math.max(...buckets.map((b) => Math.abs(b.value)), 1);
    elements.trendBars.innerHTML = buckets
      .map((item) => {
        const h = Math.max(20, Math.round((Math.abs(item.value) / max) * 110));
        return `<div><div class=\"trend-bar\" style=\"height:${h}px\"></div><span class=\"trend-bar-label\">${escapeHtml(item.label)}</span></div>`;
      })
      .join("");

    const current = buckets[buckets.length - 1]?.value || 0;
    elements.trendMeta.textContent = `Current month net: ${moneyFormatter(current)}`;
  }

  async function ensureAuthenticated() {
    try {
      return await window.FiDaCommon.getRequiredSessionToken();
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

    try {
      const [profile, rawCategories, rawTransactions, rawAccounts] = await Promise.all([
        window.FiDaCommon.fetchJson("/v1/profile", token),
        window.FiDaCommon.fetchJson("/v1/categories", token),
        window.FiDaCommon.fetchJson("/v1/transactions", token),
        window.FiDaCommon.fetchJson("/v1/accounts", token)
      ]);

      const [categories, transactions] = await Promise.all([
        maybeDecryptRecords(rawCategories),
        maybeDecryptRecords(rawTransactions)
      ]);
      const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];

      settings.currency = (profile?.currency || settings.currency || "INR").toUpperCase();
      settings.locale = profile?.locale || settings.locale || (settings.currency === "INR" ? "en-IN" : "en-US");
      window.FiDaCommon.saveDashboardSettings(settings);

      const moneyFormatter = (value) => window.FiDaCommon.formatMoney(value, settings.locale, settings.currency);

      const categoriesById = mapCategories(categories);
      renderCards(Array.isArray(transactions) ? transactions : [], moneyFormatter);
      renderCategoryBars(Array.isArray(transactions) ? transactions : [], categoriesById, moneyFormatter);
      renderAccounts(accounts, moneyFormatter);
      renderTrend(Array.isArray(transactions) ? transactions : [], moneyFormatter);

      const name = profile?.full_name || "FiDa User";
      elements.welcomeTitle.textContent = `Welcome back, ${name}`;
      elements.profileBadge.textContent = currentUsageMessage || `${settings.currency} · ${settings.locale}`;
    } catch {
      elements.profileBadge.textContent = "Unable to load dashboard right now.";
    }
  }

  async function handleLogout() {
    if (!elements.logoutBtn) {
      return;
    }
    elements.logoutBtn.disabled = true;
    try {
      await window.FiDaCommon.signOut();
    } catch {
      // Continue to login regardless.
    }
    window.location.replace("login.html");
  }

  function init() {
    const config = window.FiDaCommon.getConfig();
    window.FiDaCommon.setBaseUrl(config.baseUrl);

    applyThemeAndVisibility();
    elements.globalThemeSelect?.addEventListener("change", (event) => {
      settings.active_theme = event.currentTarget.value || "midnight";
      window.FiDaCommon.saveDashboardSettings(settings);
      applyThemeAndVisibility();
    });
    elements.logoutBtn?.addEventListener("click", handleLogout);
    loadDashboard();
  }

  init();
})();
