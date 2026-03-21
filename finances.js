(function bootstrapFinancesPage() {
  const elements = {
    globalThemeSelect: document.getElementById("globalThemeSelect"),
    logoutBtn: document.getElementById("logoutBtn"),
    subtitle: document.getElementById("financesSubtitle"),
    quickTxnForm: document.getElementById("quickTxnForm"),
    quickTxnType: document.getElementById("quickTxnType"),
    quickTxnAmount: document.getElementById("quickTxnAmount"),
    quickTxnAccount: document.getElementById("quickTxnAccount"),
    quickTxnCategory: document.getElementById("quickTxnCategory"),
    quickTxnNote: document.getElementById("quickTxnNote"),
    quickTxnSubmit: document.getElementById("quickTxnSubmit"),
    quickAccountHint: document.getElementById("quickAccountHint"),
    quickTxnStatus: document.getElementById("quickTxnStatus"),
    transactionsBody: document.getElementById("transactionsBody")
  };

  const cache = {
    categories: [],
    accounts: [],
    accountsAll: [],
    transactions: []
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setQuickTxnStatus(message, isError) {
    if (!elements.quickTxnStatus) {
      return;
    }

    elements.quickTxnStatus.textContent = message;
    elements.quickTxnStatus.classList.toggle("status-error", Boolean(isError));
  }

  function getTxnDate(txn) {
    return txn.occurred_at || txn.transaction_date || txn.date || txn.created_at || null;
  }

  function getTxnAmount(txn) {
    const amount = Number(txn.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function renderTransactions(currency, locale) {
    if (!elements.transactionsBody) {
      return;
    }

    const rows = [...cache.transactions]
      .sort((a, b) => new Date(getTxnDate(b) || 0).getTime() - new Date(getTxnDate(a) || 0).getTime())
      .slice(0, 20);

    if (!rows.length) {
      elements.transactionsBody.innerHTML = "<tr><td colspan=\"5\" class=\"muted-text\">No transactions found.</td></tr>";
      return;
    }

    const categoryMap = Object.fromEntries(cache.categories.map((item) => [String(item.id), item]));
    const accountSource = cache.accountsAll.length ? cache.accountsAll : cache.accounts;
    const accountMap = Object.fromEntries(accountSource.map((item) => [String(item.id), item]));
    const moneyFormatter = (value) => window.FiDaCommon.formatMoney(value, locale || "en-IN", currency || "INR");
    elements.transactionsBody.innerHTML = rows
      .map((txn) => {
        const type = String(txn.type || "unknown").toLowerCase();
        const accountName = accountMap[String(txn.account_id)]?.name || "Unknown account";
        const category = categoryMap[String(txn.category_id)]?.name || "Uncategorized";
        const dateText = new Date(getTxnDate(txn) || "").toLocaleDateString(locale || "en-IN");
        return `
          <tr>
            <td>${escapeHtml(dateText)}</td>
            <td>${escapeHtml(accountName)}</td>
            <td>${escapeHtml(category)}</td>
            <td><span class="txn-type ${escapeHtml(type)}">${escapeHtml(type)}</span></td>
            <td class="text-end">${moneyFormatter(getTxnAmount(txn))}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function ensureAuthenticated() {
    try {
      return await window.FiDaCommon.getRequiredSessionToken();
    } catch {
      window.location.replace("login.html");
      return "";
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

  function renderQuickTxnOptions() {
    if (!elements.quickTxnAccount || !elements.quickTxnCategory) {
      return;
    }

    const accountOptions = cache.accounts
      .map((account) => `<option value="${String(account.id)}">${escapeHtml(account.name || `Account ${account.id}`)}</option>`)
      .join("");
    elements.quickTxnAccount.innerHTML = `<option value="">Account</option>${accountOptions}`;

    if (elements.quickAccountHint) {
      const hasAccounts = cache.accounts.length > 0;
      elements.quickAccountHint.innerHTML = hasAccounts
        ? ""
        : "No accounts yet. Complete setup in <a class=\"inline-link\" href=\"settings.html\">Me > Account Setup</a>.";
      elements.quickTxnSubmit.disabled = !hasAccounts;
    }

    const selectedType = elements.quickTxnType?.value || "expense";
    const filteredCategories = cache.categories.filter((item) => String(item.kind || "").toLowerCase() === selectedType);
    const categoryOptions = filteredCategories
      .map((category) => `<option value="${String(category.id)}">${escapeHtml(category.name || `Category ${category.id}`)}</option>`)
      .join("");
    elements.quickTxnCategory.innerHTML = `<option value="">Category (optional)</option>${categoryOptions}`;
  }

  async function loadFormData() {
    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    try {
      const [profile, rawCategories, rawAccounts, rawAccountsAll, rawTransactions] = await Promise.all([
        window.FiDaCommon.fetchJson("/v1/profile", token),
        window.FiDaCommon.fetchJson("/v1/categories", token),
        window.FiDaCommon.fetchJson("/v1/accounts", token),
        window.FiDaCommon.fetchJson("/v1/accounts?include_inactive=true", token),
        window.FiDaCommon.fetchJson("/v1/transactions", token)
      ]);

      const [categories, transactions] = await Promise.all([
        maybeDecryptRecords(rawCategories),
        maybeDecryptRecords(rawTransactions)
      ]);
      const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
      const accountsAll = Array.isArray(rawAccountsAll) ? rawAccountsAll : [];

      cache.categories = Array.isArray(categories) ? categories : [];
      cache.accounts = accounts;
      cache.accountsAll = accountsAll;
      cache.transactions = Array.isArray(transactions) ? transactions : [];
      renderQuickTxnOptions();

      const currency = (profile?.currency || "INR").toUpperCase();
      const locale = profile?.locale || (currency === "INR" ? "en-IN" : "en-US");
      elements.subtitle.textContent = `Manage income, expenses, invoices, and transfers in ${currency}.`;
      renderTransactions(currency, locale);
    } catch (error) {
      setQuickTxnStatus(error.message || "Could not load finance options.", true);
    }
  }

  async function handleQuickTxnSubmit(event) {
    event.preventDefault();
    if (!elements.quickTxnForm || !elements.quickTxnType || !elements.quickTxnAmount || !elements.quickTxnAccount) {
      return;
    }

    const accountId = Number(elements.quickTxnAccount.value);
    const amount = Number(elements.quickTxnAmount.value);
    const type = String(elements.quickTxnType.value || "expense").toLowerCase();
    const categoryId = elements.quickTxnCategory?.value ? Number(elements.quickTxnCategory.value) : null;
    const note = elements.quickTxnNote?.value?.trim() || null;

    if (!Number.isInteger(accountId) || accountId <= 0) {
      setQuickTxnStatus("Select an account before saving.", true);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setQuickTxnStatus("Enter a valid amount.", true);
      return;
    }

    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    elements.quickTxnSubmit.disabled = true;
    setQuickTxnStatus("Encrypting and saving transaction...", false);

    try {
      const payload = {
        account_id: accountId,
        category_id: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
        type,
        amount,
        occurred_at: new Date().toISOString(),
        note
      };
      const encrypted = await window.FiDaCommon.encryptJsonForStorage(payload);

      const { baseUrl } = window.FiDaCommon.getConfig();
      const response = await fetch(`${baseUrl}/v1/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...payload,
          ...encrypted
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Save failed (${response.status})`);
      }

      elements.quickTxnForm.reset();
      elements.quickTxnType.value = "expense";
      renderQuickTxnOptions();
      setQuickTxnStatus("Saved securely.", false);
      loadFormData();
    } catch (error) {
      setQuickTxnStatus(error.message || "Unable to save transaction.", true);
    } finally {
      elements.quickTxnSubmit.disabled = false;
    }
  }

  function initActionButtons() {
    for (const button of document.querySelectorAll(".action-btn")) {
      button.addEventListener("click", () => {
        const action = button.dataset.action || "transaction";
        if (action === "expense" || action === "income") {
          elements.quickTxnType.value = action;
          renderQuickTxnOptions();
          elements.quickTxnAmount.focus();
          return;
        }
        setQuickTxnStatus(`${action[0].toUpperCase()}${action.slice(1)} tools are coming next.`, false);
      });
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
      // Continue to login page regardless.
    }
    window.location.replace("login.html");
  }

  function init() {
    const settings = window.FiDaCommon.getDashboardSettings();
    document.body.setAttribute("data-theme", settings.active_theme || "midnight");
    if (elements.globalThemeSelect) {
      elements.globalThemeSelect.value = settings.active_theme || "midnight";
    }

    const config = window.FiDaCommon.getConfig();
    window.FiDaCommon.setBaseUrl(config.baseUrl);

    elements.globalThemeSelect?.addEventListener("change", (event) => {
      settings.active_theme = event.currentTarget.value || "midnight";
      window.FiDaCommon.saveDashboardSettings(settings);
      document.body.setAttribute("data-theme", settings.active_theme || "midnight");
    });
    elements.quickTxnForm?.addEventListener("submit", handleQuickTxnSubmit);
    elements.quickTxnType?.addEventListener("change", renderQuickTxnOptions);
    elements.logoutBtn?.addEventListener("click", handleLogout);

    initActionButtons();
    loadFormData();
  }

  init();
})();
