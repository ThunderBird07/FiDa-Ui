(function bootstrapGoalsPage() {
  const elements = {
    globalThemeSelect: document.getElementById("globalThemeSelect"),
    logoutBtn: document.getElementById("logoutBtn"),

    goalActionBtn: document.getElementById("goalActionBtn"),
    goalActionMenu: document.getElementById("goalActionMenu"),
    goalForm: document.getElementById("goalForm"),
    goalTitleInput: document.getElementById("goalTitleInput"),
    goalAmountInput: document.getElementById("goalAmountInput"),
    goalDateInput: document.getElementById("goalDateInput"),
    goalStatusInput: document.getElementById("goalStatusInput"),
    goalDeleteBtn: document.getElementById("goalDeleteBtn"),
    goalEditBtn: document.getElementById("goalEditBtn"),
    planningGoalsList: document.getElementById("planningGoalsList"),

    billActionBtn: document.getElementById("billActionBtn"),
    billActionMenu: document.getElementById("billActionMenu"),
    billForm: document.getElementById("billForm"),
    billNameInput: document.getElementById("billNameInput"),
    billAmountTypeInput: document.getElementById("billAmountTypeInput"),
    billDueDateInput: document.getElementById("billDueDateInput"),
    billFrequencyInput: document.getElementById("billFrequencyInput"),
    billCustomFrequencyRow: document.getElementById("billCustomFrequencyRow"),
    billCustomIntervalInput: document.getElementById("billCustomIntervalInput"),
    billCustomUnitInput: document.getElementById("billCustomUnitInput"),
    billDeleteBtn: document.getElementById("billDeleteBtn"),
    billEditBtn: document.getElementById("billEditBtn"),
    upcomingBillsList: document.getElementById("upcomingBillsList"),

    planningEditModal: document.getElementById("planningEditModal"),
    planningEditModalTitle: document.getElementById("planningEditModalTitle"),
    planningEditCloseBtn: document.getElementById("planningEditCloseBtn"),
    planningEditCancelBtn: document.getElementById("planningEditCancelBtn"),
    planningEditForm: document.getElementById("planningEditForm"),
    planningEditNameInput: document.getElementById("planningEditNameInput"),
    planningEditMainRow: document.getElementById("planningEditMainRow"),
    planningEditAmountInput: document.getElementById("planningEditAmountInput"),
    planningEditDateInput: document.getElementById("planningEditDateInput"),
    planningEditMetaSelect: document.getElementById("planningEditMetaSelect"),
    planningEditAmountTypeSelect: document.getElementById("planningEditAmountTypeSelect"),
    planningEditFrequencySelect: document.getElementById("planningEditFrequencySelect"),
    planningEditCustomFrequencyRow: document.getElementById("planningEditCustomFrequencyRow"),
    planningEditCustomIntervalInput: document.getElementById("planningEditCustomIntervalInput"),
    planningEditCustomUnitInput: document.getElementById("planningEditCustomUnitInput"),

    planningDeleteModal: document.getElementById("planningDeleteModal"),
    planningDeleteMessage: document.getElementById("planningDeleteMessage"),
    planningDeleteCloseBtn: document.getElementById("planningDeleteCloseBtn"),
    planningDeleteCancelBtn: document.getElementById("planningDeleteCancelBtn"),
    planningDeleteConfirmBtn: document.getElementById("planningDeleteConfirmBtn")
  };

  const settings = window.FiDaCommon.getDashboardSettings();
  const selectedGoalIds = new Set();
  const selectedBillIds = new Set();
  const editState = { kind: null, id: null };
  const deleteState = { kind: null };
  let billProgressTransactions = [];

  document.body.setAttribute("data-theme", settings.active_theme || "midnight");
  if (elements.globalThemeSelect) {
    elements.globalThemeSelect.value = settings.active_theme || "midnight";
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

  function formatStatusLabel(value) {
    const normalized = String(value || "planned").replaceAll("_", " ");
    return normalized.slice(0, 1).toUpperCase() + normalized.slice(1);
  }

  function formatAmountTypeLabel(amountType) {
    return amountType === "tentative" ? "Tentative amount" : "Fixed amount";
  }

  function formatRecurrenceLabel(bill) {
    switch (bill.frequency) {
      case "monthly":
        return "Monthly";
      case "bi_monthly":
        return "Every 2 months";
      case "quarterly":
        return "Quarterly";
      case "half_yearly":
        return "Half-yearly";
      case "yearly":
        return "Yearly";
      case "one_time":
        return "One-time";
      case "custom": {
        const interval = Math.max(1, Number(bill.custom_interval || 1));
        const unit = String(bill.custom_unit || "month");
        const suffix = interval > 1 ? "s" : "";
        return `Every ${interval} ${unit}${suffix}`;
      }
      default:
        return formatStatusLabel(bill.frequency);
    }
  }

  function normalizeBillPayload(rawBill) {
    const bill = rawBill || {};
    const amountType = bill.amount_type === "tentative" ? "tentative" : "fixed";
    const frequency = String(bill.frequency || "monthly");
    const customInterval = Math.max(1, Number(bill.custom_interval || 1));
    const customUnit = ["week", "month", "year"].includes(String(bill.custom_unit || ""))
      ? String(bill.custom_unit)
      : "month";

    return {
      id: String(bill.id || crypto.randomUUID()),
      name: String(bill.name || "Untitled bill"),
      due_date: String(bill.due_date || ""),
      amount_type: amountType,
      frequency,
      custom_interval: customInterval,
      custom_unit: customUnit
    };
  }

  function statusMeta(status) {
    if (status === "completed") {
      return { label: "Completed", css: "completed" };
    }
    if (status === "past_due") {
      return { label: "Past due", css: "past-due" };
    }
    return { label: "Upcoming", css: "upcoming" };
  }

  function closeActionMenu(kind) {
    if (kind === "goal") {
      elements.goalActionMenu?.setAttribute("hidden", "");
      elements.goalActionBtn?.setAttribute("aria-expanded", "false");
      return;
    }

    elements.billActionMenu?.setAttribute("hidden", "");
    elements.billActionBtn?.setAttribute("aria-expanded", "false");
  }

  function openActionMenu(kind) {
    if (kind === "goal") {
      closeActionMenu("bill");
      elements.goalActionMenu?.removeAttribute("hidden");
      elements.goalActionBtn?.setAttribute("aria-expanded", "true");
      return;
    }

    closeActionMenu("goal");
    elements.billActionMenu?.removeAttribute("hidden");
    elements.billActionBtn?.setAttribute("aria-expanded", "true");
  }

  function updateGoalActionState() {
    const selectedCount = selectedGoalIds.size;
    if (elements.goalDeleteBtn) {
      elements.goalDeleteBtn.disabled = selectedCount === 0;
      elements.goalDeleteBtn.classList.toggle("is-enabled", selectedCount > 0);
    }
    if (elements.goalEditBtn) {
      elements.goalEditBtn.disabled = selectedCount !== 1;
      elements.goalEditBtn.classList.toggle("is-enabled", selectedCount === 1);
    }
  }

  function updateBillActionState() {
    const selectedCount = selectedBillIds.size;
    if (elements.billDeleteBtn) {
      elements.billDeleteBtn.disabled = selectedCount === 0;
      elements.billDeleteBtn.classList.toggle("is-enabled", selectedCount > 0);
    }
    if (elements.billEditBtn) {
      elements.billEditBtn.disabled = selectedCount !== 1;
      elements.billEditBtn.classList.toggle("is-enabled", selectedCount === 1);
    }
  }

  function toggleAddBillCustomFrequency() {
    if (!elements.billFrequencyInput || !elements.billCustomFrequencyRow) {
      return;
    }
    const isCustom = elements.billFrequencyInput.value === "custom";
    if (isCustom) {
      elements.billCustomFrequencyRow.removeAttribute("hidden");
    } else {
      elements.billCustomFrequencyRow.setAttribute("hidden", "");
    }
  }

  function toggleEditBillCustomFrequency() {
    if (!elements.planningEditFrequencySelect || !elements.planningEditCustomFrequencyRow) {
      return;
    }
    const isCustom = elements.planningEditFrequencySelect.value === "custom";
    if (isCustom) {
      elements.planningEditCustomFrequencyRow.removeAttribute("hidden");
    } else {
      elements.planningEditCustomFrequencyRow.setAttribute("hidden", "");
    }
  }

  function renderGoals() {
    if (!elements.planningGoalsList) {
      return;
    }

    const goals = window.FiDaCommon.getPlanningGoals();
    const goalIdSet = new Set(goals.map((goal) => goal.id));
    for (const goalId of Array.from(selectedGoalIds)) {
      if (!goalIdSet.has(goalId)) {
        selectedGoalIds.delete(goalId);
      }
    }

    if (!goals.length) {
      elements.planningGoalsList.innerHTML = "<p class=\"muted-text\">No goals added yet. Use the + action to add one.</p>";
      updateGoalActionState();
      return;
    }

    const moneyFormatter = (value) => window.FiDaCommon.formatMoney(value, settings.locale, settings.currency);
    elements.planningGoalsList.innerHTML = goals
      .slice(0, 200)
      .map((goal) => {
        const isSelected = selectedGoalIds.has(goal.id);
        return `
          <div class="account-row planning-item-row">
            <label class="planning-item-label" for="goalSelect-${escapeHtml(goal.id)}">
              <input
                id="goalSelect-${escapeHtml(goal.id)}"
                class="planning-row-checkbox"
                type="checkbox"
                data-goal-select="${escapeHtml(goal.id)}"
                ${isSelected ? "checked" : ""}
              />
              <span class="planning-item-title">${escapeHtml(goal.title)}<small class="muted-text"> · ${escapeHtml(formatStatusLabel(goal.status))}</small></span>
            </label>
            <strong>${moneyFormatter(Number(goal.target_amount || 0))}</strong>
          </div>
          <p class="muted-text bill-due">Target: ${escapeHtml(formatDueDate(goal.target_date))}</p>
        `;
      })
      .join("");

    for (const checkbox of elements.planningGoalsList.querySelectorAll("[data-goal-select]")) {
      checkbox.addEventListener("change", (event) => {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) {
          return;
        }
        const goalId = input.getAttribute("data-goal-select");
        if (!goalId) {
          return;
        }
        if (input.checked) {
          selectedGoalIds.add(goalId);
        } else {
          selectedGoalIds.delete(goalId);
        }
        updateGoalActionState();
      });
    }

    updateGoalActionState();
  }

  function renderBills() {
    if (!elements.upcomingBillsList) {
      return;
    }

    const bills = window.FiDaCommon.getUpcomingBills().map(normalizeBillPayload);
    const billIdSet = new Set(bills.map((bill) => bill.id));
    for (const billId of Array.from(selectedBillIds)) {
      if (!billIdSet.has(billId)) {
        selectedBillIds.delete(billId);
      }
    }

    if (!bills.length) {
      elements.upcomingBillsList.innerHTML = "<p class=\"muted-text\">No bills yet. Use the + action to add one.</p>";
      updateBillActionState();
      return;
    }

    elements.upcomingBillsList.innerHTML = bills
      .slice(0, 200)
      .map((bill) => {
        const isSelected = selectedBillIds.has(bill.id);
        const amountTypeLabel = formatAmountTypeLabel(bill.amount_type);
        const recurrenceLabel = formatRecurrenceLabel(bill);
        const progress = window.FiDaCommon.getBillProgressStatusForDate(bill, billProgressTransactions, new Date());
        const progressInfo = statusMeta(progress.status);
        const displayDue = progress.dueDateIso || bill.due_date;

        return `
          <div class="account-row planning-item-row">
            <label class="planning-item-label" for="billSelect-${escapeHtml(bill.id)}">
              <input
                id="billSelect-${escapeHtml(bill.id)}"
                class="planning-row-checkbox"
                type="checkbox"
                data-bill-select="${escapeHtml(bill.id)}"
                ${isSelected ? "checked" : ""}
              />
              <span class="planning-item-title">${escapeHtml(bill.name)}<small class="muted-text"> · ${escapeHtml(recurrenceLabel)}</small></span>
            </label>
            <strong>${escapeHtml(amountTypeLabel)}</strong>
          </div>
          <p class="muted-text bill-due">Due: ${escapeHtml(formatDueDate(displayDue))} · ${escapeHtml(recurrenceLabel)}</p>
          <p class="muted-text bill-due">Progress: <span class="planning-progress-text planning-progress-${escapeHtml(progressInfo.css)}">${escapeHtml(progressInfo.label)}</span></p>
        `;
      })
      .join("");

    for (const checkbox of elements.upcomingBillsList.querySelectorAll("[data-bill-select]")) {
      checkbox.addEventListener("change", (event) => {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) {
          return;
        }
        const billId = input.getAttribute("data-bill-select");
        if (!billId) {
          return;
        }
        if (input.checked) {
          selectedBillIds.add(billId);
        } else {
          selectedBillIds.delete(billId);
        }
        updateBillActionState();
      });
    }

    updateBillActionState();
  }

  function handleAddGoal(event) {
    event.preventDefault();
    if (!elements.goalTitleInput || !elements.goalAmountInput || !elements.goalDateInput || !elements.goalStatusInput) {
      return;
    }

    const title = elements.goalTitleInput.value.trim();
    const targetAmount = Number(elements.goalAmountInput.value || 0);
    const targetDate = elements.goalDateInput.value;
    const status = elements.goalStatusInput.value;

    if (!title || !Number.isFinite(targetAmount) || targetAmount <= 0 || !targetDate) {
      return;
    }

    const goals = window.FiDaCommon.getPlanningGoals();
    goals.push({
      id: crypto.randomUUID(),
      title,
      target_amount: targetAmount,
      target_date: targetDate,
      status
    });
    window.FiDaCommon.savePlanningGoals(goals);
    elements.goalForm?.reset();
    closeActionMenu("goal");
    renderGoals();
  }

  function handleAddBill(event) {
    event.preventDefault();
    if (
      !elements.billNameInput ||
      !elements.billAmountTypeInput ||
      !elements.billDueDateInput ||
      !elements.billFrequencyInput ||
      !elements.billCustomIntervalInput ||
      !elements.billCustomUnitInput
    ) {
      return;
    }

    const name = elements.billNameInput.value.trim();
    const dueDate = elements.billDueDateInput.value;
    const amountType = elements.billAmountTypeInput.value === "tentative" ? "tentative" : "fixed";
    const frequency = elements.billFrequencyInput.value;
    const customInterval = Math.max(1, Number(elements.billCustomIntervalInput.value || 1));
    const customUnit = elements.billCustomUnitInput.value;

    if (!name || !dueDate) {
      return;
    }

    const bills = window.FiDaCommon.getUpcomingBills().map(normalizeBillPayload);
    bills.push({
      id: crypto.randomUUID(),
      name,
      due_date: dueDate,
      amount_type: amountType,
      frequency,
      custom_interval: frequency === "custom" ? customInterval : 0,
      custom_unit: frequency === "custom" ? customUnit : "month"
    });
    window.FiDaCommon.saveUpcomingBills(bills);

    elements.billForm?.reset();
    if (elements.billFrequencyInput) {
      elements.billFrequencyInput.value = "monthly";
    }
    if (elements.billAmountTypeInput) {
      elements.billAmountTypeInput.value = "fixed";
    }
    if (elements.billCustomIntervalInput) {
      elements.billCustomIntervalInput.value = "2";
    }
    if (elements.billCustomUnitInput) {
      elements.billCustomUnitInput.value = "month";
    }
    toggleAddBillCustomFrequency();

    closeActionMenu("bill");
    renderBills();
  }

  function openDeleteModal(kind, selectedCount) {
    if (!elements.planningDeleteModal || !elements.planningDeleteMessage) {
      return;
    }
    deleteState.kind = kind;
    const noun = kind === "goal" ? "goal" : "bill";
    const plural = selectedCount > 1 ? "s" : "";
    elements.planningDeleteMessage.textContent = `Delete ${selectedCount} selected ${noun}${plural}? This action cannot be undone.`;
    elements.planningDeleteModal.removeAttribute("hidden");
  }

  function closeDeleteModal() {
    elements.planningDeleteModal?.setAttribute("hidden", "");
    deleteState.kind = null;
  }

  function deleteSelectedGoals() {
    if (!selectedGoalIds.size) {
      return;
    }
    openDeleteModal("goal", selectedGoalIds.size);
  }

  function deleteSelectedBills() {
    if (!selectedBillIds.size) {
      return;
    }
    openDeleteModal("bill", selectedBillIds.size);
  }

  function confirmDeleteSelection() {
    if (deleteState.kind === "goal") {
      const nextGoals = window.FiDaCommon.getPlanningGoals().filter((goal) => !selectedGoalIds.has(goal.id));
      window.FiDaCommon.savePlanningGoals(nextGoals);
      selectedGoalIds.clear();
      closeDeleteModal();
      renderGoals();
      return;
    }

    if (deleteState.kind === "bill") {
      const nextBills = window.FiDaCommon
        .getUpcomingBills()
        .map(normalizeBillPayload)
        .filter((bill) => !selectedBillIds.has(bill.id));
      window.FiDaCommon.saveUpcomingBills(nextBills);
      selectedBillIds.clear();
      closeDeleteModal();
      renderBills();
    }
  }

  function configureEditModalForGoal(item) {
    if (
      !elements.planningEditModalTitle ||
      !elements.planningEditNameInput ||
      !elements.planningEditMainRow ||
      !elements.planningEditAmountInput ||
      !elements.planningEditDateInput ||
      !elements.planningEditMetaSelect ||
      !elements.planningEditAmountTypeSelect ||
      !elements.planningEditFrequencySelect ||
      !elements.planningEditCustomFrequencyRow
    ) {
      return;
    }

    elements.planningEditModalTitle.textContent = "Edit Goal";
    elements.planningEditNameInput.placeholder = "Goal title";
    elements.planningEditNameInput.maxLength = 120;

    elements.planningEditMainRow.classList.remove("inline-form-row-single");
    elements.planningEditAmountInput.removeAttribute("hidden");
    elements.planningEditAmountInput.required = true;
    elements.planningEditAmountInput.placeholder = "Target amount";

    elements.planningEditMetaSelect.removeAttribute("hidden");
    elements.planningEditMetaSelect.innerHTML = [
      '<option value="planned">Planned</option>',
      '<option value="in_progress">In Progress</option>',
      '<option value="on_hold">On Hold</option>'
    ].join("");

    elements.planningEditAmountTypeSelect.setAttribute("hidden", "");
    elements.planningEditFrequencySelect.setAttribute("hidden", "");
    elements.planningEditCustomFrequencyRow.setAttribute("hidden", "");

    elements.planningEditNameInput.value = String(item.title || "");
    elements.planningEditAmountInput.value = String(Number(item.target_amount || 0));
    elements.planningEditDateInput.value = String(item.target_date || "");
    elements.planningEditMetaSelect.value = String(item.status || "planned");
  }

  function configureEditModalForBill(rawItem) {
    if (
      !elements.planningEditModalTitle ||
      !elements.planningEditNameInput ||
      !elements.planningEditMainRow ||
      !elements.planningEditAmountInput ||
      !elements.planningEditDateInput ||
      !elements.planningEditMetaSelect ||
      !elements.planningEditAmountTypeSelect ||
      !elements.planningEditFrequencySelect ||
      !elements.planningEditCustomFrequencyRow ||
      !elements.planningEditCustomIntervalInput ||
      !elements.planningEditCustomUnitInput
    ) {
      return;
    }

    const item = normalizeBillPayload(rawItem);

    elements.planningEditModalTitle.textContent = "Edit Bill";
    elements.planningEditNameInput.placeholder = "Bill name";
    elements.planningEditNameInput.maxLength = 100;

    elements.planningEditMainRow.classList.add("inline-form-row-single");
    elements.planningEditAmountInput.setAttribute("hidden", "");
    elements.planningEditAmountInput.required = false;
    elements.planningEditAmountInput.value = "";

    elements.planningEditMetaSelect.setAttribute("hidden", "");
    elements.planningEditMetaSelect.innerHTML = "";

    elements.planningEditAmountTypeSelect.removeAttribute("hidden");
    elements.planningEditFrequencySelect.removeAttribute("hidden");

    elements.planningEditNameInput.value = item.name;
    elements.planningEditDateInput.value = item.due_date;
    elements.planningEditAmountTypeSelect.value = item.amount_type;
    elements.planningEditFrequencySelect.value = item.frequency;
    elements.planningEditCustomIntervalInput.value = String(Math.max(1, Number(item.custom_interval || 1)));
    elements.planningEditCustomUnitInput.value = item.custom_unit;
    toggleEditBillCustomFrequency();
  }

  function openEditModal(kind, item) {
    if (!elements.planningEditModal) {
      return;
    }

    editState.kind = kind;
    editState.id = item.id;

    if (kind === "goal") {
      configureEditModalForGoal(item);
    } else {
      configureEditModalForBill(item);
    }

    elements.planningEditModal.removeAttribute("hidden");
  }

  function closeEditModal() {
    elements.planningEditModal?.setAttribute("hidden", "");
    elements.planningEditForm?.reset();
    editState.kind = null;
    editState.id = null;
  }

  function openGoalEditForSelection() {
    if (selectedGoalIds.size !== 1) {
      return;
    }
    const selectedId = Array.from(selectedGoalIds)[0];
    const item = window.FiDaCommon.getPlanningGoals().find((goal) => goal.id === selectedId);
    if (!item) {
      return;
    }
    openEditModal("goal", item);
  }

  function openBillEditForSelection() {
    if (selectedBillIds.size !== 1) {
      return;
    }
    const selectedId = Array.from(selectedBillIds)[0];
    const item = window.FiDaCommon.getUpcomingBills().map(normalizeBillPayload).find((bill) => bill.id === selectedId);
    if (!item) {
      return;
    }
    openEditModal("bill", item);
  }

  function handleEditSubmit(event) {
    event.preventDefault();
    if (
      !editState.kind ||
      !editState.id ||
      !elements.planningEditNameInput ||
      !elements.planningEditDateInput ||
      !elements.planningEditAmountInput ||
      !elements.planningEditMetaSelect ||
      !elements.planningEditAmountTypeSelect ||
      !elements.planningEditFrequencySelect ||
      !elements.planningEditCustomIntervalInput ||
      !elements.planningEditCustomUnitInput
    ) {
      return;
    }

    const nameValue = elements.planningEditNameInput.value.trim();
    const dateValue = elements.planningEditDateInput.value;

    if (!nameValue || !dateValue) {
      return;
    }

    if (editState.kind === "goal") {
      const amountValue = Number(elements.planningEditAmountInput.value || 0);
      const statusValue = elements.planningEditMetaSelect.value;
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        return;
      }

      const nextGoals = window.FiDaCommon.getPlanningGoals().map((goal) => {
        if (goal.id !== editState.id) {
          return goal;
        }
        return {
          ...goal,
          title: nameValue,
          target_amount: amountValue,
          target_date: dateValue,
          status: statusValue
        };
      });

      window.FiDaCommon.savePlanningGoals(nextGoals);
      closeEditModal();
      renderGoals();
      return;
    }

    const amountTypeValue = elements.planningEditAmountTypeSelect.value === "tentative" ? "tentative" : "fixed";
    const frequencyValue = elements.planningEditFrequencySelect.value;
    const customInterval = Math.max(1, Number(elements.planningEditCustomIntervalInput.value || 1));
    const customUnit = elements.planningEditCustomUnitInput.value;

    const nextBills = window.FiDaCommon.getUpcomingBills().map(normalizeBillPayload).map((bill) => {
      if (bill.id !== editState.id) {
        return bill;
      }
      return {
        ...bill,
        name: nameValue,
        due_date: dateValue,
        amount_type: amountTypeValue,
        frequency: frequencyValue,
        custom_interval: frequencyValue === "custom" ? customInterval : 0,
        custom_unit: frequencyValue === "custom" ? customUnit : "month"
      };
    });

    window.FiDaCommon.saveUpcomingBills(nextBills);
    closeEditModal();
    renderBills();
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

  async function ensureAuthenticated() {
    try {
      return await window.FiDaCommon.getRequiredSessionToken();
    } catch {
      window.location.replace("login.html");
      return "";
    }
  }

  async function refreshBillProgressTransactions() {
    const token = await ensureAuthenticated();
    if (!token) {
      return;
    }

    try {
      const rawTransactions = await window.FiDaCommon.fetchJson("/v1/transactions?limit=500&sort_by=occurred_at&sort_dir=desc", token);
      const decrypted = await maybeDecryptRecords(rawTransactions);
      billProgressTransactions = Array.isArray(decrypted) ? decrypted : [];
    } catch {
      billProgressTransactions = [];
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

  function setupActionMenus() {
    elements.goalActionBtn?.addEventListener("click", () => {
      const isOpen = !elements.goalActionMenu?.hasAttribute("hidden");
      if (isOpen) {
        closeActionMenu("goal");
      } else {
        openActionMenu("goal");
      }
    });

    elements.billActionBtn?.addEventListener("click", () => {
      const isOpen = !elements.billActionMenu?.hasAttribute("hidden");
      if (isOpen) {
        closeActionMenu("bill");
      } else {
        openActionMenu("bill");
      }
    });
  }

  function setupPageEvents() {
    elements.goalForm?.addEventListener("submit", handleAddGoal);
    elements.billForm?.addEventListener("submit", handleAddBill);
    elements.billFrequencyInput?.addEventListener("change", toggleAddBillCustomFrequency);

    elements.goalDeleteBtn?.addEventListener("click", deleteSelectedGoals);
    elements.billDeleteBtn?.addEventListener("click", deleteSelectedBills);
    elements.goalEditBtn?.addEventListener("click", openGoalEditForSelection);
    elements.billEditBtn?.addEventListener("click", openBillEditForSelection);

    elements.planningEditForm?.addEventListener("submit", handleEditSubmit);
    elements.planningEditCloseBtn?.addEventListener("click", closeEditModal);
    elements.planningEditCancelBtn?.addEventListener("click", closeEditModal);
    elements.planningEditFrequencySelect?.addEventListener("change", toggleEditBillCustomFrequency);

    elements.planningDeleteCloseBtn?.addEventListener("click", closeDeleteModal);
    elements.planningDeleteCancelBtn?.addEventListener("click", closeDeleteModal);
    elements.planningDeleteConfirmBtn?.addEventListener("click", confirmDeleteSelection);

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        elements.goalActionMenu &&
        elements.goalActionBtn &&
        !elements.goalActionMenu.hasAttribute("hidden") &&
        !elements.goalActionMenu.contains(target) &&
        !elements.goalActionBtn.contains(target)
      ) {
        closeActionMenu("goal");
      }

      if (
        elements.billActionMenu &&
        elements.billActionBtn &&
        !elements.billActionMenu.hasAttribute("hidden") &&
        !elements.billActionMenu.contains(target) &&
        !elements.billActionBtn.contains(target)
      ) {
        closeActionMenu("bill");
      }

      if (elements.planningEditModal && target === elements.planningEditModal) {
        closeEditModal();
      }

      if (elements.planningDeleteModal && target === elements.planningDeleteModal) {
        closeDeleteModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }
      closeActionMenu("goal");
      closeActionMenu("bill");
      closeEditModal();
      closeDeleteModal();
    });

    elements.globalThemeSelect?.addEventListener("change", (event) => {
      settings.active_theme = event.currentTarget.value || "midnight";
      window.FiDaCommon.saveDashboardSettings(settings);
      document.body.setAttribute("data-theme", settings.active_theme || "midnight");
    });

    elements.logoutBtn?.addEventListener("click", handleLogout);
  }

  async function init() {
    toggleAddBillCustomFrequency();
    setupActionMenus();
    setupPageEvents();
    renderGoals();

    await refreshBillProgressTransactions();
    renderBills();
  }

  init();
})();
