(function bootstrapGoalsPage() {
  const elements = {
    globalThemeSelect: document.getElementById("globalThemeSelect"),
    logoutBtn: document.getElementById("logoutBtn"),
    goalForm: document.getElementById("goalForm"),
    goalTitleInput: document.getElementById("goalTitleInput"),
    goalAmountInput: document.getElementById("goalAmountInput"),
    goalDateInput: document.getElementById("goalDateInput"),
    goalStatusInput: document.getElementById("goalStatusInput"),
    planningGoalsList: document.getElementById("planningGoalsList"),
    billForm: document.getElementById("billForm"),
    billNameInput: document.getElementById("billNameInput"),
    billAmountInput: document.getElementById("billAmountInput"),
    billDueDateInput: document.getElementById("billDueDateInput"),
    billFrequencyInput: document.getElementById("billFrequencyInput"),
    upcomingBillsList: document.getElementById("upcomingBillsList")
  };

  const settings = window.FiDaCommon.getDashboardSettings();
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

  function renderGoals() {
    if (!elements.planningGoalsList) {
      return;
    }

    const goals = window.FiDaCommon.getPlanningGoals();
    if (!goals.length) {
      elements.planningGoalsList.innerHTML = "<p class=\"muted-text\">No goals added yet. Add one from Goal Setup.</p>";
      return;
    }

    const moneyFormatter = (value) => window.FiDaCommon.formatMoney(value, settings.locale, settings.currency);
    elements.planningGoalsList.innerHTML = goals
      .slice(0, 12)
      .map((goal) => {
        const statusLabel = goal.status.replaceAll("_", " ");
        return `
          <div class="account-row">
            <span>${escapeHtml(goal.title)}<small class="muted-text"> · ${escapeHtml(statusLabel)}</small></span>
            <div class="bill-row-actions">
              <strong>${moneyFormatter(Number(goal.target_amount || 0))}</strong>
              <button class="ghost-btn danger-btn" type="button" data-goal-id="${escapeHtml(goal.id)}">Remove</button>
            </div>
          </div>
          <p class="muted-text bill-due">Target: ${escapeHtml(formatDueDate(goal.target_date))}</p>
        `;
      })
      .join("");

    for (const btn of elements.planningGoalsList.querySelectorAll("[data-goal-id]")) {
      btn.addEventListener("click", (event) => {
        const goalId = event.currentTarget.getAttribute("data-goal-id");
        const nextGoals = window.FiDaCommon.getPlanningGoals().filter((item) => item.id !== goalId);
        window.FiDaCommon.savePlanningGoals(nextGoals);
        renderGoals();
      });
    }
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
    renderGoals();
  }

  function renderBills() {
    if (!elements.upcomingBillsList) {
      return;
    }

    const bills = window.FiDaCommon.getUpcomingBills();
    if (!bills.length) {
      elements.upcomingBillsList.innerHTML = "<p class=\"muted-text\">No upcoming bills yet. Add one from Bill Setup.</p>";
      return;
    }

    const moneyFormatter = (value) => window.FiDaCommon.formatMoney(value, settings.locale, settings.currency);
    elements.upcomingBillsList.innerHTML = bills
      .slice(0, 12)
      .map((bill) => {
        const frequencyLabel = bill.frequency === "one_time" ? "One-time" : bill.frequency;
        return `
          <div class="account-row">
            <span>${escapeHtml(bill.name)}<small class="muted-text"> · ${escapeHtml(frequencyLabel)}</small></span>
            <div class="bill-row-actions">
              <strong>${moneyFormatter(Number(bill.amount || 0))}</strong>
              <button class="ghost-btn danger-btn" type="button" data-bill-id="${escapeHtml(bill.id)}">Remove</button>
            </div>
          </div>
          <p class="muted-text bill-due">Due: ${escapeHtml(formatDueDate(bill.due_date))}</p>
        `;
      })
      .join("");

    for (const btn of elements.upcomingBillsList.querySelectorAll("[data-bill-id]")) {
      btn.addEventListener("click", (event) => {
        const billId = event.currentTarget.getAttribute("data-bill-id");
        const nextBills = window.FiDaCommon.getUpcomingBills().filter((item) => item.id !== billId);
        window.FiDaCommon.saveUpcomingBills(nextBills);
        renderBills();
      });
    }
  }

  function handleAddBill(event) {
    event.preventDefault();
    if (!elements.billNameInput || !elements.billAmountInput || !elements.billDueDateInput || !elements.billFrequencyInput) {
      return;
    }

    const name = elements.billNameInput.value.trim();
    const amount = Number(elements.billAmountInput.value || 0);
    const dueDate = elements.billDueDateInput.value;
    const frequency = elements.billFrequencyInput.value;

    if (!name || !Number.isFinite(amount) || amount <= 0 || !dueDate) {
      return;
    }

    const bills = window.FiDaCommon.getUpcomingBills();
    bills.push({
      id: crypto.randomUUID(),
      name,
      amount,
      due_date: dueDate,
      frequency
    });
    window.FiDaCommon.saveUpcomingBills(bills);
    elements.billForm?.reset();
    renderBills();
  }

  async function ensureAuthenticated() {
    try {
      await window.FiDaCommon.getRequiredSessionToken();
    } catch {
      window.location.replace("login.html");
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

  elements.logoutBtn?.addEventListener("click", handleLogout);
  elements.globalThemeSelect?.addEventListener("change", (event) => {
    settings.active_theme = event.currentTarget.value || "midnight";
    window.FiDaCommon.saveDashboardSettings(settings);
    document.body.setAttribute("data-theme", settings.active_theme || "midnight");
  });
  elements.goalForm?.addEventListener("submit", handleAddGoal);
  elements.billForm?.addEventListener("submit", handleAddBill);
  renderGoals();
  renderBills();
  ensureAuthenticated();
})();
