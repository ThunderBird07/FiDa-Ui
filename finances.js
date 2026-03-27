(function bootstrapFinancesPage() {
  const elements = {
    globalThemeSelect: document.getElementById("globalThemeSelect"),
    logoutBtn: document.getElementById("logoutBtn"),
    subtitle: document.getElementById("financesSubtitle"),
    toast: document.getElementById("toast"),
    txnAccountDropdown: document.getElementById("txnAccountDropdown"),
    txnAccountTrigger: document.getElementById("txnAccountTrigger"),
    txnAccountValue: document.getElementById("txnAccountValue"),
    txnAccountMenu: document.getElementById("txnAccountMenu"),
    txnAccountSearch: document.getElementById("txnAccountSearch"),
    txnAccountList: document.getElementById("txnAccountList"),
    txnSearchInput: document.getElementById("txnSearchInput"),
    txnFilterWrap: document.getElementById("txnFilterWrap"),
    txnFilterBtn: document.getElementById("txnFilterBtn"),
    txnFilterPopover: document.getElementById("txnFilterPopover"),
    txnFilterTypeSelect: document.getElementById("txnFilterTypeSelect"),
    txnFilterAccountSelect: document.getElementById("txnFilterAccountSelect"),
    txnFilterCategorySelect: document.getElementById("txnFilterCategorySelect"),
    txnFilterApplyBtn: document.getElementById("txnFilterApplyBtn"),
    txnFilterClearBtn: document.getElementById("txnFilterClearBtn"),
    txnSortSelect: document.getElementById("txnSortSelect"),
    txnDateRangeWrap: document.getElementById("txnDateRangeWrap"),
    txnDateRangeBtn: document.getElementById("txnDateRangeBtn"),
    txnDateRangePopover: document.getElementById("txnDateRangePopover"),
    txnDateFrom: document.getElementById("txnDateFrom"),
    txnDateTo: document.getElementById("txnDateTo"),
    txnDateApplyBtn: document.getElementById("txnDateApplyBtn"),
    txnDateClearBtn: document.getElementById("txnDateClearBtn"),
    txnResetBtn: document.getElementById("txnResetBtn"),
    txnSelectAll: document.getElementById("txnSelectAll"),
    deleteSelectedTxnsBtn: document.getElementById("deleteSelectedTxnsBtn"),
    transactionsBody: document.getElementById("transactionsBody"),
    txnModalBackdrop: document.getElementById("txnModalBackdrop"),
    txnModalTitle: document.getElementById("txnModalTitle"),
    txnModalSubtitle: document.getElementById("txnModalSubtitle"),
    closeTxnModalBtn: document.getElementById("closeTxnModalBtn"),
    cancelTxnModalBtn: document.getElementById("cancelTxnModalBtn"),
    txnModalForm: document.getElementById("txnModalForm"),
    txnModalCategory: document.getElementById("txnModalCategory"),
    txnModalAmount: document.getElementById("txnModalAmount"),
    txnInvoiceRef: document.getElementById("txnInvoiceRef"),
    txnModalNote: document.getElementById("txnModalNote"),
    txnLinkBillRow: document.getElementById("txnLinkBillRow"),
    txnLinkBillToggle: document.getElementById("txnLinkBillToggle"),
    txnLinkBillSelect: document.getElementById("txnLinkBillSelect"),
    txnModalSubmit: document.getElementById("txnModalSubmit"),
    txnDeleteModalBackdrop: document.getElementById("txnDeleteModalBackdrop"),
    txnDeleteModalText: document.getElementById("txnDeleteModalText"),
    closeTxnDeleteModalBtn: document.getElementById("closeTxnDeleteModalBtn"),
    confirmTxnDeleteBtn: document.getElementById("confirmTxnDeleteBtn"),
    cancelTxnDeleteBtn: document.getElementById("cancelTxnDeleteBtn")
  };

  const cache = {
    categories: [],
    accounts: [],
    accountsAll: [],
    transactions: [],
    bills: []
  };

  let activeTxnAction = "expense";
  let toastTimer = null;
  let selectedAccountId = null;
  const selectedTransactionIds = new Set();
  let currentCurrency = "INR";
  let currentLocale = "en-IN";
  let deleteConfirmResolver = null;
  let searchDebounceTimer = null;
  const clientTzOffsetMinutes = new Date().getTimezoneOffset();

  const queryState = {
    q: "",
    type: "all",
    accountId: "all",
    categoryId: "all",
    sortBy: "occurred_at",
    sortDir: "desc",
    fromDate: "",
    toDate: ""
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function showToast(message, isError, allowHtml) {
    if (!elements.toast) {
      return;
    }

    if (allowHtml) {
      elements.toast.innerHTML = message;
    } else {
      elements.toast.textContent = message;
    }
    elements.toast.classList.toggle("toast-error", Boolean(isError));
    elements.toast.classList.add("toast-visible");

    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      elements.toast?.classList.remove("toast-visible");
    }, 2600);
  }

  function getTxnDate(txn) {
    return txn.occurred_at || txn.transaction_date || txn.date || txn.created_at || null;
  }

  function getTxnAmount(txn) {
    const amount = Number(txn.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getActionType(action) {
    if (action === "invoice") {
      return "income";
    }
    if (action === "transfer") {
      return "transfer";
    }
    return action === "income" ? "income" : "expense";
  }

  function accountLabel(account) {
    const name = String(account?.name || `Account ${account?.id || ""}`).trim();
    return `${name}`;
  }

  function getSelectedAccountId() {
    return Number.isInteger(selectedAccountId) && selectedAccountId > 0 ? selectedAccountId : null;
  }

  function getAccountById(accountId) {
    return cache.accounts.find((item) => Number(item.id) === Number(accountId)) || null;
  }

  function getBillById(billId) {
    return cache.bills.find((item) => String(item.id) === String(billId)) || null;
  }

  function renderLinkedBillOptions() {
    if (!elements.txnLinkBillSelect) {
      return;
    }

    const options = cache.bills
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map((bill) => `<option value="${escapeHtml(String(bill.id))}">${escapeHtml(String(bill.name || "Bill"))}</option>`)
      .join("");

    elements.txnLinkBillSelect.innerHTML = `<option value="">Select bill</option>${options}`;
  }

  function updateBillLinkControls() {
    if (!elements.txnLinkBillRow || !elements.txnLinkBillToggle || !elements.txnLinkBillSelect) {
      return;
    }

    const canLink = getActionType(activeTxnAction) === "expense";
    if (!canLink) {
      elements.txnLinkBillRow.setAttribute("hidden", "");
      elements.txnLinkBillToggle.checked = false;
      elements.txnLinkBillSelect.value = "";
      elements.txnLinkBillSelect.disabled = true;
      elements.txnLinkBillSelect.setAttribute("hidden", "");
      return;
    }

    elements.txnLinkBillRow.removeAttribute("hidden");
    const isLinked = Boolean(elements.txnLinkBillToggle.checked);
    elements.txnLinkBillSelect.disabled = !isLinked;
    if (isLinked) {
      elements.txnLinkBillSelect.removeAttribute("hidden");
    } else {
      elements.txnLinkBillSelect.setAttribute("hidden", "");
      elements.txnLinkBillSelect.value = "";
    }
  }

  function setSelectedAccount(accountId) {
    const account = getAccountById(accountId);
    if (!account) {
      selectedAccountId = null;
      if (elements.txnAccountValue) {
        elements.txnAccountValue.textContent = "Select account";
      }
      return;
    }

    selectedAccountId = Number(account.id);
    if (elements.txnAccountValue) {
      elements.txnAccountValue.textContent = accountLabel(account);
    }
  }

  function closeAccountMenu() {
    if (!elements.txnAccountMenu || !elements.txnAccountTrigger || !elements.txnAccountSearch) {
      return;
    }
    elements.txnAccountMenu.hidden = true;
    elements.txnAccountTrigger.setAttribute("aria-expanded", "false");
    elements.txnAccountSearch.value = "";
  }

  function openAccountMenu() {
    if (!elements.txnAccountMenu || !elements.txnAccountTrigger || !elements.txnAccountSearch) {
      return;
    }
    renderAccountOptions(elements.txnAccountSearch.value);
    elements.txnAccountMenu.hidden = false;
    elements.txnAccountTrigger.setAttribute("aria-expanded", "true");
    setTimeout(() => elements.txnAccountSearch?.focus(), 0);
  }

  function renderAccountOptions(filterText) {
    if (!elements.txnAccountList) {
      return;
    }

    const query = String(filterText || "").trim().toLowerCase();
    const accounts = cache.accounts.filter((account) => {
      if (!query) {
        return true;
      }
      return accountLabel(account).toLowerCase().includes(query);
    });

    if (!accounts.length) {
      elements.txnAccountList.innerHTML = `<li class="txn-select-empty">${query ? "No matching account." : "No active accounts."}</li>`;
      return;
    }

    elements.txnAccountList.innerHTML = accounts
      .map((account) => {
        const isActive = Number(account.id) === getSelectedAccountId();
        return `
          <li>
            <button
              type="button"
              class="txn-select-option${isActive ? " is-selected" : ""}"
              data-account-id="${String(account.id)}"
              role="option"
              aria-selected="${isActive ? "true" : "false"}"
            >
              ${escapeHtml(accountLabel(account))}
            </button>
          </li>
        `;
      })
      .join("");
  }

  function renderTransactions(currency, locale) {
    if (!elements.transactionsBody) {
      return;
    }

    const rows = [...cache.transactions];

    if (!rows.length) {
      elements.transactionsBody.innerHTML = "<tr><td colspan=\"6\" class=\"muted-text\">No transactions found.</td></tr>";
      syncSelectionControls([]);
      return;
    }

    const categoryMap = Object.fromEntries(cache.categories.map((item) => [String(item.id), item]));
    const accountSource = cache.accountsAll.length ? cache.accountsAll : cache.accounts;
    const accountMap = Object.fromEntries(accountSource.map((item) => [String(item.id), item]));
    const moneyFormatter = (value) => window.FiDaCommon.formatMoney(value, locale || "en-IN", currency || "INR");
    elements.transactionsBody.innerHTML = rows
      .map((txn) => {
        const type = String(txn.type || "unknown").toLowerCase();
        const txnId = Number(txn.id);
        const isChecked = Number.isInteger(txnId) && selectedTransactionIds.has(txnId);
        const accountName = accountMap[String(txn.account_id)]?.name || "Unknown account";
        const category = categoryMap[String(txn.category_id)]?.name || "Uncategorized";
        const dateText = new Date(getTxnDate(txn) || "").toLocaleDateString(locale || "en-IN");
        return `
          <tr>
            <td class="txn-select-col"><input class="txn-row-checkbox" type="checkbox" data-txn-id="${String(txn.id || "")}" ${isChecked ? "checked" : ""} /></td>
            <td>${escapeHtml(dateText)}</td>
            <td>${escapeHtml(accountName)}</td>
            <td>${escapeHtml(category)}</td>
            <td><span class="txn-type ${escapeHtml(type)}">${escapeHtml(type)}</span></td>
            <td class="text-end">${moneyFormatter(getTxnAmount(txn))}</td>
          </tr>
        `;
      })
      .join("");

    const visibleIds = rows
      .map((txn) => Number(txn.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    syncSelectionControls(visibleIds);
  }

  function getVisibleTransactionIds() {
    return cache.transactions
      .map((txn) => Number(txn.id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  function updateQueryControls() {
    if (elements.txnFilterTypeSelect) {
      elements.txnFilterTypeSelect.value = queryState.type;
    }
    if (elements.txnFilterAccountSelect) {
      elements.txnFilterAccountSelect.value = queryState.accountId;
    }
    if (elements.txnFilterCategorySelect) {
      elements.txnFilterCategorySelect.value = queryState.categoryId;
    }
    if (elements.txnSortSelect) {
      elements.txnSortSelect.value = `${queryState.sortBy}:${queryState.sortDir}`;
    }
    if (elements.txnSearchInput && elements.txnSearchInput.value !== queryState.q) {
      elements.txnSearchInput.value = queryState.q;
    }
    if (elements.txnDateFrom) {
      elements.txnDateFrom.value = queryState.fromDate || "";
    }
    if (elements.txnDateTo) {
      elements.txnDateTo.value = queryState.toDate || "";
    }
    const activeFilterCount = [
      queryState.type !== "all",
      queryState.accountId !== "all",
      queryState.categoryId !== "all"
    ].filter(Boolean).length;
    elements.txnFilterBtn?.classList.toggle("is-filter-active", activeFilterCount > 0);
    if (elements.txnFilterBtn) {
      elements.txnFilterBtn.title = activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : "Filters";
    }
    elements.txnDateRangeBtn?.classList.toggle("is-date-active", Boolean(queryState.fromDate || queryState.toDate));
  }

  function closeFilterPopover() {
    if (!elements.txnFilterPopover) {
      return;
    }
    elements.txnFilterPopover.hidden = true;
    elements.txnFilterBtn?.setAttribute("aria-expanded", "false");
  }

  function openFilterPopover() {
    if (!elements.txnFilterPopover) {
      return;
    }
    elements.txnFilterPopover.hidden = false;
    elements.txnFilterBtn?.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      elements.txnFilterTypeSelect?.focus();
    }, 0);
  }

  function renderFilterOptions() {
    if (elements.txnFilterAccountSelect) {
      const accountOptions = cache.accounts
        .map((account) => `<option value="${String(account.id)}">${escapeHtml(account.name || `Account ${account.id}`)}</option>`)
        .join("");
      elements.txnFilterAccountSelect.innerHTML = `<option value="all">All</option>${accountOptions}`;
      if (!cache.accounts.some((account) => String(account.id) === String(queryState.accountId))) {
        queryState.accountId = "all";
      }
    }

    if (elements.txnFilterCategorySelect) {
      const categoryOptions = cache.categories
        .map((category) => `<option value="${String(category.id)}">${escapeHtml(category.name || `Category ${category.id}`)}</option>`)
        .join("");
      elements.txnFilterCategorySelect.innerHTML = `<option value="all">All</option>${categoryOptions}`;
      if (!cache.categories.some((category) => String(category.id) === String(queryState.categoryId))) {
        queryState.categoryId = "all";
      }
    }
  }

  function closeDateRangePopover() {
    if (!elements.txnDateRangePopover) {
      return;
    }
    elements.txnDateRangePopover.hidden = true;
    elements.txnDateRangeBtn?.setAttribute("aria-expanded", "false");
  }

  function openDateRangePopover() {
    if (!elements.txnDateRangePopover) {
      return;
    }
    elements.txnDateRangePopover.hidden = false;
    elements.txnDateRangeBtn?.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      elements.txnDateFrom?.focus();
    }, 0);
  }

  function toDayStartIso(dateText) {
    const [year, month, day] = String(dateText || "").split("-").map(Number);
    if (!year || !month || !day) {
      return "";
    }
    return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
  }

  function toDayEndIso(dateText) {
    const [year, month, day] = String(dateText || "").split("-").map(Number);
    if (!year || !month || !day) {
      return "";
    }
    return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
  }

  function buildTransactionsPath() {
    const params = new URLSearchParams();
    params.set("limit", "150");
    params.set("sort_by", queryState.sortBy);
    params.set("sort_dir", queryState.sortDir);
    params.set("tz_offset_minutes", String(clientTzOffsetMinutes));

    if (queryState.type !== "all") {
      params.set("type", queryState.type);
    }
    if (queryState.accountId !== "all") {
      params.set("account_id", String(queryState.accountId));
    }
    if (queryState.categoryId !== "all") {
      params.set("category_id", String(queryState.categoryId));
    }
    if (queryState.q.trim()) {
      params.set("q", queryState.q.trim());
    }
    if (queryState.fromDate) {
      params.set("from_date", toDayStartIso(queryState.fromDate));
    }
    if (queryState.toDate) {
      params.set("to_date", toDayEndIso(queryState.toDate));
    }

    return `/v1/transactions?${params.toString()}`;
  }

  function syncSelectionControls(visibleIds) {
    const visibleSet = new Set(visibleIds);
    for (const txnId of [...selectedTransactionIds]) {
      if (!visibleSet.has(txnId) && !cache.transactions.some((txn) => Number(txn.id) === txnId)) {
        selectedTransactionIds.delete(txnId);
      }
    }

    const selectedVisibleCount = visibleIds.filter((id) => selectedTransactionIds.has(id)).length;
    if (elements.txnSelectAll) {
      elements.txnSelectAll.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
      elements.txnSelectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
    }

    if (elements.deleteSelectedTxnsBtn) {
      elements.deleteSelectedTxnsBtn.disabled = selectedTransactionIds.size === 0;
      elements.deleteSelectedTxnsBtn.title = selectedTransactionIds.size
        ? `Delete ${selectedTransactionIds.size} selected transaction${selectedTransactionIds.size === 1 ? "" : "s"}`
        : "Select transactions to delete";
    }
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

  function renderAccountAndCategoryOptions() {
    if (!elements.txnModalCategory) {
      return;
    }

    if (getSelectedAccountId() && !getAccountById(getSelectedAccountId())) {
      setSelectedAccount(null);
    }
    renderAccountOptions(elements.txnAccountSearch?.value || "");

    const type = getActionType(activeTxnAction);
    const categories = type === "expense" || type === "income"
      ? cache.categories.filter((item) => String(item.kind || "").toLowerCase() === type)
      : [];

    const categoryOptions = categories
      .map((category) => `<option value="${String(category.id)}">${escapeHtml(category.name || `Category ${category.id}`)}</option>`)
      .join("");
    elements.txnModalCategory.innerHTML = `<option value="">Category (optional)</option>${categoryOptions}`;
  }

  function openTxnModal(action) {
    activeTxnAction = action || "expense";
    if (!elements.txnModalBackdrop) {
      return;
    }

    const labels = {
      expense: "Add Expense",
      income: "Add Income",
      invoice: "Create Invoice",
      transfer: "Transfer Funds"
    };

    if (elements.txnModalTitle) {
      elements.txnModalTitle.textContent = labels[activeTxnAction] || "Add Transaction";
    }

    if (elements.txnModalSubtitle) {
      elements.txnModalSubtitle.textContent = activeTxnAction === "invoice"
        ? "Invoice entries are saved as income transactions."
        : "Enter transaction details and save securely.";
    }

    if (elements.txnInvoiceRef) {
      elements.txnInvoiceRef.style.display = activeTxnAction === "invoice" ? "block" : "none";
      elements.txnInvoiceRef.value = "";
    }

    renderAccountAndCategoryOptions();
    renderLinkedBillOptions();
    elements.txnModalForm?.reset();
    if (elements.txnLinkBillToggle) {
      elements.txnLinkBillToggle.checked = false;
    }
    if (elements.txnLinkBillSelect) {
      elements.txnLinkBillSelect.value = "";
    }
    updateBillLinkControls();

    elements.txnModalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      elements.txnModalAmount?.focus();
    }, 0);
  }

  function closeTxnModal() {
    if (!elements.txnModalBackdrop) {
      return;
    }
    elements.txnModalBackdrop.hidden = true;
    document.body.style.overflow = "";
    elements.txnModalForm?.reset();
  }

  function closeTxnDeleteModal(confirmed) {
    if (!elements.txnDeleteModalBackdrop) {
      return;
    }
    elements.txnDeleteModalBackdrop.hidden = true;
    document.body.style.overflow = "";

    if (deleteConfirmResolver) {
      deleteConfirmResolver(Boolean(confirmed));
      deleteConfirmResolver = null;
    }
  }

  function openTxnDeleteModal(selectedCount) {
    if (!elements.txnDeleteModalBackdrop || !elements.txnDeleteModalText) {
      return Promise.resolve(false);
    }

    if (deleteConfirmResolver) {
      deleteConfirmResolver(false);
      deleteConfirmResolver = null;
    }

    elements.txnDeleteModalText.textContent =
      `Delete ${selectedCount} selected transaction${selectedCount === 1 ? "" : "s"}?`;
    elements.txnDeleteModalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";

    setTimeout(() => {
      elements.confirmTxnDeleteBtn?.focus();
    }, 0);

    return new Promise((resolve) => {
      deleteConfirmResolver = resolve;
    });
  }

  async function loadReferenceData() {
    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    try {
      const [profile, rawCategories, rawAccounts, rawAccountsAll] = await Promise.all([
        window.FiDaCommon.fetchJson("/v1/profile", token),
        window.FiDaCommon.fetchJson("/v1/categories", token),
        window.FiDaCommon.fetchJson("/v1/accounts", token),
        window.FiDaCommon.fetchJson("/v1/accounts?include_inactive=true", token)
      ]);

      const categories = await maybeDecryptRecords(rawCategories);

      cache.categories = Array.isArray(categories) ? categories : [];
      cache.accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
      cache.accountsAll = Array.isArray(rawAccountsAll) ? rawAccountsAll : [];
      cache.bills = window.FiDaCommon.getUpcomingBills();
      renderFilterOptions();

      const currency = (profile?.currency || "INR").toUpperCase();
      const locale = profile?.locale || (currency === "INR" ? "en-IN" : "en-US");
      currentCurrency = currency;
      currentLocale = locale;
      elements.subtitle.textContent = `Manage income, expenses, invoices, and transfers in ${currency}.`;
      renderAccountAndCategoryOptions();
      renderLinkedBillOptions();
    } catch (error) {
      showToast(error.message || "Could not load finance options.", true);
    }
  }

  async function loadTransactions() {
    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    try {
      const rawTransactions = await window.FiDaCommon.fetchJson(buildTransactionsPath(), token);
      const transactions = await maybeDecryptRecords(rawTransactions);

      cache.transactions = Array.isArray(transactions) ? transactions : [];
      const liveTransactionIds = new Set(cache.transactions.map((txn) => Number(txn.id)).filter((id) => Number.isInteger(id) && id > 0));
      for (const txnId of [...selectedTransactionIds]) {
        if (!liveTransactionIds.has(txnId)) {
          selectedTransactionIds.delete(txnId);
        }
      }

      renderTransactions(currentCurrency, currentLocale);
    } catch (error) {
      showToast(error.message || "Could not load transactions.", true);
    }
  }

  async function loadFinanceData() {
    await loadReferenceData();
    await loadTransactions();
  }

  async function handleTxnModalSubmit(event) {
    event.preventDefault();
    if (!elements.txnModalAmount || !elements.txnModalSubmit) {
      return;
    }

    const accountId = getSelectedAccountId();
    const amount = Number(elements.txnModalAmount.value);
    const transactionType = getActionType(activeTxnAction);
    const categoryId = elements.txnModalCategory?.value ? Number(elements.txnModalCategory.value) : null;
    const noteRaw = elements.txnModalNote?.value?.trim() || "";
    const invoiceRef = elements.txnInvoiceRef?.value?.trim() || "";
    const note = activeTxnAction === "invoice"
      ? [invoiceRef ? `Invoice ${invoiceRef}` : "Invoice", noteRaw].filter(Boolean).join(" - ")
      : (noteRaw || null);

    const billLinkEnabled =
      transactionType === "expense" &&
      Boolean(elements.txnLinkBillToggle?.checked);
    const linkedBillId = billLinkEnabled ? String(elements.txnLinkBillSelect?.value || "").trim() : "";

    if (!Number.isInteger(accountId) || accountId <= 0) {
      showToast("Choose a valid account from the search box first.", true);
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount.", true);
      return;
    }

    if (billLinkEnabled && !linkedBillId) {
      showToast("Choose a bill to link this expense.", true);
      return;
    }

    const linkedBill = billLinkEnabled ? getBillById(linkedBillId) : null;
    if (billLinkEnabled && !linkedBill) {
      showToast("Selected bill is no longer available.", true);
      return;
    }

    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    elements.txnModalSubmit.disabled = true;
    showToast("Encrypting and saving transaction...", false);

    try {
      const payload = {
        account_id: accountId,
        category_id: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
        type: transactionType,
        amount,
        occurred_at: new Date().toISOString(),
        note
      };

      let encryptedPayload = payload;
      if (linkedBill) {
        const progress = window.FiDaCommon.getBillProgressStatusForDate(linkedBill, cache.transactions, new Date());
        const linkedCycleKey = String(progress.cycleKey || progress.dueDateIso || linkedBill.due_date || "");
        encryptedPayload = {
          ...payload,
          linked_bill_id: String(linkedBill.id),
          linked_bill_cycle_key: linkedCycleKey
        };
      }

      const encrypted = await window.FiDaCommon.encryptJsonForStorage(encryptedPayload);
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

      showToast("Saved securely.", false);
      closeTxnModal();
      await loadTransactions();
    } catch (error) {
      showToast(error.message || "Unable to save transaction.", true);
    } finally {
      elements.txnModalSubmit.disabled = false;
    }
  }

  function initActionButtons() {
    for (const button of document.querySelectorAll(".txn-tool-btn[data-action]")) {
      button.addEventListener("click", () => {
        if (!cache.accounts.length) {
          showToast("No active account available. Complete setup in <a class=\"inline-link\" href=\"settings.html\">Me &gt; Account Setup</a>.", true, true);
          return;
        }
        if (!getSelectedAccountId()) {
          showToast("Please choose an account from the dropdown before continuing.", true);
          return;
        }
        openTxnModal(button.dataset.action || "expense");
      });
    }

    elements.deleteSelectedTxnsBtn?.addEventListener("click", handleDeleteSelectedTransactions);
  }

  async function handleDeleteSelectedTransactions() {
    const selectedIds = [...selectedTransactionIds];
    if (!selectedIds.length) {
      showToast("Select at least one transaction to delete.", true);
      return;
    }

    const confirmed = await openTxnDeleteModal(selectedIds.length);
    if (!confirmed) {
      return;
    }

    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    const { baseUrl } = window.FiDaCommon.getConfig();
    const apiRoot = baseUrl || "";

    elements.deleteSelectedTxnsBtn.disabled = true;
    showToast("Deleting selected transactions...", false);

    let deletedCount = 0;
    let failedCount = 0;

    for (const transactionId of selectedIds) {
      try {
        const response = await fetch(`${apiRoot}/v1/transactions/${transactionId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Delete failed (${response.status})`);
        }
        selectedTransactionIds.delete(transactionId);
        deletedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    if (failedCount > 0) {
      showToast(`Deleted ${deletedCount} transaction${deletedCount === 1 ? "" : "s"}; ${failedCount} failed.`, true);
    } else {
      showToast(`Deleted ${deletedCount} transaction${deletedCount === 1 ? "" : "s"}.`, false);
    }

    await loadTransactions();
  }

  function initTransactionSelection() {
    elements.txnSelectAll?.addEventListener("change", (event) => {
      const shouldSelect = Boolean(event.currentTarget.checked);
      const visibleIds = getVisibleTransactionIds();

      for (const txnId of visibleIds) {
        if (shouldSelect) {
          selectedTransactionIds.add(txnId);
        } else {
          selectedTransactionIds.delete(txnId);
        }
      }

      renderTransactions(currentCurrency, currentLocale);
    });

    elements.transactionsBody?.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".txn-row-checkbox");
      if (!checkbox) {
        return;
      }

      const txnId = Number(checkbox.dataset.txnId || 0);
      if (!Number.isInteger(txnId) || txnId <= 0) {
        return;
      }

      if (checkbox.checked) {
        selectedTransactionIds.add(txnId);
      } else {
        selectedTransactionIds.delete(txnId);
      }

      const visibleIds = getVisibleTransactionIds();
      syncSelectionControls(visibleIds);
    });
  }

  function scheduleTransactionsReload() {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      loadTransactions();
    }, 320);
  }

  function initSearchFilterSortControls() {
    updateQueryControls();

    elements.txnSearchInput?.addEventListener("input", (event) => {
      queryState.q = String(event.currentTarget.value || "");
      scheduleTransactionsReload();
    });

    elements.txnFilterBtn?.addEventListener("click", () => {
      if (elements.txnFilterPopover?.hidden) {
        openFilterPopover();
      } else {
        closeFilterPopover();
      }
    });

    elements.txnFilterApplyBtn?.addEventListener("click", () => {
      queryState.type = String(elements.txnFilterTypeSelect?.value || "all");
      queryState.accountId = String(elements.txnFilterAccountSelect?.value || "all");
      queryState.categoryId = String(elements.txnFilterCategorySelect?.value || "all");
      updateQueryControls();
      closeFilterPopover();
      loadTransactions();
    });

    elements.txnFilterClearBtn?.addEventListener("click", () => {
      queryState.type = "all";
      queryState.accountId = "all";
      queryState.categoryId = "all";
      updateQueryControls();
      closeFilterPopover();
      loadTransactions();
    });

    elements.txnSortSelect?.addEventListener("change", (event) => {
      const rawValue = String(event.currentTarget.value || "occurred_at:desc");
      const [sortBy, sortDir] = rawValue.split(":");
      queryState.sortBy = sortBy || "occurred_at";
      queryState.sortDir = sortDir || "desc";
      loadTransactions();
    });

    elements.txnDateRangeBtn?.addEventListener("click", () => {
      if (elements.txnDateRangePopover?.hidden) {
        openDateRangePopover();
      } else {
        closeDateRangePopover();
      }
    });

    elements.txnDateApplyBtn?.addEventListener("click", () => {
      const fromDate = String(elements.txnDateFrom?.value || "");
      const toDate = String(elements.txnDateTo?.value || "");

      if (fromDate && toDate && fromDate > toDate) {
        showToast("Start date must be before or equal to end date.", true);
        return;
      }

      queryState.fromDate = fromDate;
      queryState.toDate = toDate;
      updateQueryControls();
      closeDateRangePopover();
      loadTransactions();
    });

    elements.txnDateClearBtn?.addEventListener("click", () => {
      queryState.fromDate = "";
      queryState.toDate = "";
      updateQueryControls();
      closeDateRangePopover();
      loadTransactions();
    });

    elements.txnResetBtn?.addEventListener("click", () => {
      queryState.q = "";
      queryState.type = "all";
      queryState.accountId = "all";
      queryState.categoryId = "all";
      queryState.sortBy = "occurred_at";
      queryState.sortDir = "desc";
      queryState.fromDate = "";
      queryState.toDate = "";
      updateQueryControls();
      closeDateRangePopover();
      loadTransactions();
    });

    document.addEventListener("click", (event) => {
      if (!elements.txnFilterWrap?.contains(event.target)) {
        closeFilterPopover();
      }
      if (!elements.txnDateRangeWrap?.contains(event.target)) {
        closeDateRangePopover();
      }
    });
  }

  function initAccountDropdown() {
    if (!elements.txnAccountDropdown || !elements.txnAccountTrigger || !elements.txnAccountMenu || !elements.txnAccountList) {
      return;
    }

    elements.txnAccountTrigger.addEventListener("click", () => {
      if (elements.txnAccountMenu.hidden) {
        openAccountMenu();
      } else {
        closeAccountMenu();
      }
    });

    elements.txnAccountSearch?.addEventListener("input", (event) => {
      renderAccountOptions(event.currentTarget.value || "");
    });

    elements.txnAccountList.addEventListener("click", (event) => {
      const option = event.target.closest(".txn-select-option");
      if (!option) {
        return;
      }

      const accountId = Number(option.dataset.accountId || 0);
      if (!Number.isInteger(accountId) || accountId <= 0) {
        return;
      }

      setSelectedAccount(accountId);
      closeAccountMenu();
    });

    document.addEventListener("click", (event) => {
      if (!elements.txnAccountDropdown.contains(event.target)) {
        closeAccountMenu();
      }
    });
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

    elements.txnModalForm?.addEventListener("submit", handleTxnModalSubmit);
    elements.closeTxnModalBtn?.addEventListener("click", closeTxnModal);
    elements.cancelTxnModalBtn?.addEventListener("click", closeTxnModal);
    elements.txnLinkBillToggle?.addEventListener("change", updateBillLinkControls);
    elements.txnModalBackdrop?.addEventListener("click", (event) => {
      if (event.target === elements.txnModalBackdrop) {
        closeTxnModal();
      }
    });
    elements.txnDeleteModalBackdrop?.addEventListener("click", (event) => {
      if (event.target === elements.txnDeleteModalBackdrop) {
        closeTxnDeleteModal(false);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }
      if (elements.txnFilterPopover && !elements.txnFilterPopover.hidden) {
        closeFilterPopover();
        return;
      }
      if (elements.txnDateRangePopover && !elements.txnDateRangePopover.hidden) {
        closeDateRangePopover();
        return;
      }
      if (elements.txnDeleteModalBackdrop && !elements.txnDeleteModalBackdrop.hidden) {
        closeTxnDeleteModal(false);
        return;
      }
      if (elements.txnAccountMenu && !elements.txnAccountMenu.hidden) {
        closeAccountMenu();
        return;
      }
      if (elements.txnModalBackdrop && !elements.txnModalBackdrop.hidden) {
        closeTxnModal();
      }
    });

    elements.closeTxnDeleteModalBtn?.addEventListener("click", () => closeTxnDeleteModal(false));
    elements.cancelTxnDeleteBtn?.addEventListener("click", () => closeTxnDeleteModal(false));
    elements.confirmTxnDeleteBtn?.addEventListener("click", () => closeTxnDeleteModal(true));

    elements.logoutBtn?.addEventListener("click", handleLogout);

    initAccountDropdown();
    initSearchFilterSortControls();
    initTransactionSelection();
    initActionButtons();
    updateBillLinkControls();
    loadFinanceData();
  }

  init();
})();