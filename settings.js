(function bootstrapSettingsPage() {
  const elements = {
    globalThemeSelect: document.getElementById("globalThemeSelect"),
    profileForm: document.getElementById("profileForm"),
    fullNameInput: document.getElementById("fullNameInput"),
    emailInput: document.getElementById("emailInput"),
    countryInput: document.getElementById("countryInput"),
    updateProfileBtn: document.getElementById("updateProfileBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    passwordForm: document.getElementById("passwordForm"),
    newPasswordInput: document.getElementById("newPasswordInput"),
    confirmNewPasswordInput: document.getElementById("confirmNewPasswordInput"),
    changePasswordBtn: document.getElementById("changePasswordBtn"),
    accountSetupForm: document.getElementById("accountSetupForm"),
    accountNameInput: document.getElementById("accountNameInput"),
    accountTypeInput: document.getElementById("accountTypeInput"),
    accountBalanceInput: document.getElementById("accountBalanceInput"),
    accountCurrencyInput: document.getElementById("accountCurrencyInput"),
    addAccountBtn: document.getElementById("addAccountBtn"),
    openAccountModalBtn: document.getElementById("openAccountModalBtn"),
    closeAccountModalBtn: document.getElementById("closeAccountModalBtn"),
    cancelAccountModalBtn: document.getElementById("cancelAccountModalBtn"),
    accountModalBackdrop: document.getElementById("accountModalBackdrop"),
    deleteAccountModalBackdrop: document.getElementById("deleteAccountModalBackdrop"),
    closeDeleteAccountModalBtn: document.getElementById("closeDeleteAccountModalBtn"),
    cancelDeleteAccountModalBtn: document.getElementById("cancelDeleteAccountModalBtn"),
    confirmDeleteAccountBtn: document.getElementById("confirmDeleteAccountBtn"),
    deleteAccountWithTransactions: document.getElementById("deleteAccountWithTransactions"),
    deleteAccountWarningText: document.getElementById("deleteAccountWarningText"),
    settingsAccountsBody: document.getElementById("settingsAccountsBody"),
    toast: document.getElementById("toast")
  };

  if (!elements.globalThemeSelect) {
    return;
  }

  let settings = window.FiDaCommon.getDashboardSettings();
  let toastTimer = null;
  let profileCurrency = settings.currency || "INR";
  let profileLocale = settings.locale || "en-IN";
  let cachedAccounts = [];
  let pendingDeleteAccountId = null;

  function syncBodyScrollLock() {
    const accountOpen = Boolean(elements.accountModalBackdrop && !elements.accountModalBackdrop.hidden);
    const deleteOpen = Boolean(elements.deleteAccountModalBackdrop && !elements.deleteAccountModalBackdrop.hidden);
    document.body.style.overflow = accountOpen || deleteOpen ? "hidden" : "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function renderAccountsTable() {
    if (!elements.settingsAccountsBody) {
      return;
    }

    if (!cachedAccounts.length) {
      elements.settingsAccountsBody.innerHTML = "<tr><td colspan=\"4\" class=\"muted-text\">No accounts yet. Add your first account above.</td></tr>";
      return;
    }

    elements.settingsAccountsBody.innerHTML = cachedAccounts
      .slice()
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
      .map((account) => {
        const money = window.FiDaCommon.formatMoney(
          Number(account.balance || 0),
          profileLocale || "en-IN",
          (account.currency || profileCurrency || "INR").toUpperCase()
        );
        const accountId = Number(account.id || 0);

        return `
          <tr>
            <td>${escapeHtml(account.name || `Account ${accountId}`)}</td>
            <td>${escapeHtml(String(account.type || "bank").toUpperCase())}</td>
            <td class="text-end">${escapeHtml(money)}</td>
            <td class="text-end">
              <button type="button" class="ghost-btn danger-btn" data-account-delete="${accountId}">Remove</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadAccounts(token) {
    if (!token) {
      return;
    }

    try {
      const response = await requestWithFallback("/v1/accounts", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Could not load accounts (${response.status}).`);
      }
      const rawAccounts = await response.json();
      cachedAccounts = Array.isArray(rawAccounts) ? rawAccounts.filter((item) => item?.is_active !== false) : [];
      renderAccountsTable();
    } catch (error) {
      showToast(normalizeRequestError(error, "Could not load accounts."), true);
    }
  }

  function showToast(message, isError) {
    if (!elements.toast) {
      return;
    }

    elements.toast.textContent = message;
    elements.toast.classList.toggle("toast-error", Boolean(isError));
    elements.toast.classList.add("toast-visible");

    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      elements.toast.classList.remove("toast-visible");
    }, 2600);
  }

  function applyThemePreview(theme) {
    document.body.setAttribute("data-theme", theme || "midnight");
  }

  function normalizeRequestError(error, fallbackMessage) {
    const message = String(error?.message || "");
    if (/failed to fetch|networkerror|network error/i.test(message)) {
      return "Could not reach backend. Check API URL/server and try again.";
    }
    return message || fallbackMessage;
  }

  async function requestWithFallback(path, options) {
    const { baseUrl } = window.FiDaCommon.getConfig();
    const urls = [];
    if (baseUrl) {
      urls.push(`${baseUrl}${path}`);
    }
    urls.push(path);

    let lastError = null;
    for (const url of [...new Set(urls)]) {
      try {
        return await fetch(url, options);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Request failed.");
  }

  function openAccountModal() {
    if (!elements.accountModalBackdrop) {
      return;
    }
    elements.accountModalBackdrop.hidden = false;
    syncBodyScrollLock();
    if (elements.accountCurrencyInput && !elements.accountCurrencyInput.value) {
      elements.accountCurrencyInput.value = profileCurrency;
    }
    setTimeout(() => {
      elements.accountNameInput?.focus();
    }, 0);
  }

  function closeAccountModal() {
    if (!elements.accountModalBackdrop) {
      return;
    }
    elements.accountModalBackdrop.hidden = true;
    syncBodyScrollLock();
  }

  function openDeleteAccountModal(accountId) {
    if (!elements.deleteAccountModalBackdrop) {
      return;
    }
    pendingDeleteAccountId = accountId;
    if (elements.deleteAccountWithTransactions) {
      elements.deleteAccountWithTransactions.checked = false;
    }

    const account = cachedAccounts.find((item) => Number(item.id) === Number(accountId));
    if (elements.deleteAccountWarningText) {
      const accountName = account?.name || `Account ${accountId}`;
      elements.deleteAccountWarningText.textContent = `Heads up: ${accountName} will be removed from active views. If you enable the switch, all linked transactions will be deleted permanently.`;
    }

    elements.deleteAccountModalBackdrop.hidden = false;
    syncBodyScrollLock();
  }

  function closeDeleteAccountModal() {
    if (!elements.deleteAccountModalBackdrop) {
      return;
    }
    elements.deleteAccountModalBackdrop.hidden = true;
    pendingDeleteAccountId = null;
    syncBodyScrollLock();
  }

  async function executeAccountDelete(accountId, deleteTransactions) {
    const token = await window.FiDaCommon.getRequiredSessionToken();
    const query = deleteTransactions ? "?delete_transactions=true" : "";
    const response = await requestWithFallback(`/v1/accounts/${accountId}${query}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Could not remove account.");
    }

    return token;
  }

  function persistTheme(theme, notify) {
    settings.active_theme = theme || "midnight";
    settings = window.FiDaCommon.saveDashboardSettings(settings);
    applyThemePreview(settings.active_theme);
    if (notify) {
      showToast("Theme updated.", false);
    }
  }

  async function loadProfile() {
    if (!elements.fullNameInput || !elements.emailInput || !elements.countryInput) {
      return;
    }

    try {
      const token = await window.FiDaCommon.getRequiredSessionToken();
      const profile = await window.FiDaCommon.fetchJson("/v1/profile", token);
      elements.fullNameInput.value = profile?.full_name || "";
      elements.emailInput.value = profile?.email || window.FiDaCommon.getEmail() || "";
      elements.countryInput.value = (profile?.country || "US").toUpperCase();
      profileCurrency = (profile?.currency || settings.currency || "INR").toUpperCase();
      profileLocale = profile?.locale || settings.locale || (profileCurrency === "INR" ? "en-IN" : "en-US");
      if (elements.accountCurrencyInput) {
        elements.accountCurrencyInput.value = profileCurrency;
      }
      await loadAccounts(token);
    } catch {
      showToast("Could not load profile details.", true);
    }
  }

  async function handleAccountSetup(event) {
    event.preventDefault();
    if (!elements.accountNameInput || !elements.accountTypeInput || !elements.accountBalanceInput || !elements.accountCurrencyInput || !elements.addAccountBtn) {
      return;
    }

    const name = elements.accountNameInput.value.trim();
    const type = String(elements.accountTypeInput.value || "bank").toLowerCase();
    const balance = Number(elements.accountBalanceInput.value || 0);
    const currency = String(elements.accountCurrencyInput.value || profileCurrency || "INR").trim().toUpperCase();

    if (!name) {
      showToast("Account name is required.", true);
      return;
    }
    if (!Number.isFinite(balance)) {
      showToast("Opening balance must be a valid number.", true);
      return;
    }
    if (!currency || currency.length !== 3) {
      showToast("Currency must be a 3-letter code.", true);
      return;
    }

    elements.addAccountBtn.disabled = true;

    try {
      const token = await window.FiDaCommon.getRequiredSessionToken();
      const payload = {
        name,
        type,
        balance,
        currency
      };
      const encrypted = await window.FiDaCommon.encryptJsonForStorage(payload);
      const response = await requestWithFallback("/v1/accounts", {
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
        const message = await response.text();
        throw new Error(message || "Could not create account.");
      }

      elements.accountSetupForm?.reset();
      if (elements.accountCurrencyInput) {
        elements.accountCurrencyInput.value = profileCurrency;
      }
      showToast("Account added successfully.", false);
      await loadAccounts(token);
      closeAccountModal();
    } catch (error) {
      showToast(normalizeRequestError(error, "Could not add account."), true);
    } finally {
      elements.addAccountBtn.disabled = false;
    }
  }

  async function handleAccountRemove(event) {
    const trigger = event.target instanceof HTMLElement ? event.target.closest("[data-account-delete]") : null;
    if (!trigger) {
      return;
    }

    const accountId = Number(trigger.getAttribute("data-account-delete"));
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return;
    }

    openDeleteAccountModal(accountId);
  }

  async function handleConfirmDeleteAccount() {
    if (!Number.isInteger(pendingDeleteAccountId) || pendingDeleteAccountId <= 0) {
      return;
    }

    const accountId = pendingDeleteAccountId;
    const deleteTransactions = Boolean(elements.deleteAccountWithTransactions?.checked);
    elements.confirmDeleteAccountBtn?.setAttribute("disabled", "disabled");

    try {
      const token = await executeAccountDelete(accountId, deleteTransactions);

      showToast("Account removed.", false);
      await loadAccounts(token);
      closeDeleteAccountModal();
    } catch (error) {
      showToast(normalizeRequestError(error, "Could not remove account."), true);
    } finally {
      elements.confirmDeleteAccountBtn?.removeAttribute("disabled");
    }
  }

  async function handleProfileUpdate(event) {
    event.preventDefault();
    if (!elements.fullNameInput || !elements.emailInput || !elements.countryInput || !elements.updateProfileBtn) {
      return;
    }

    const fullName = elements.fullNameInput.value.trim();
    const email = elements.emailInput.value.trim();
    const country = String(elements.countryInput.value || "").trim().toUpperCase();
    if (!email) {
      showToast("Email is required.", true);
      return;
    }
    if (!country) {
      showToast("Country is required.", true);
      return;
    }

    elements.updateProfileBtn.disabled = true;

    try {
      const token = await window.FiDaCommon.getRequiredSessionToken();
      const client = window.FiDaCommon.getSupabaseClient();

      const { error: authUpdateError } = await client.auth.updateUser({ email });
      if (authUpdateError) {
        throw new Error(authUpdateError.message || "Could not update email.");
      }

      const config = window.FiDaCommon.getConfig();
      const response = await fetch(`${config.baseUrl}/v1/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: fullName || null,
          email,
          country
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Could not update profile details.");
      }

      window.FiDaCommon.setEmail(email);
      showToast("Profile updated successfully.", false);
    } catch (error) {
      showToast(error.message || "Could not update profile.", true);
    } finally {
      elements.updateProfileBtn.disabled = false;
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    if (!elements.newPasswordInput || !elements.confirmNewPasswordInput || !elements.changePasswordBtn) {
      return;
    }

    const newPassword = elements.newPasswordInput.value;
    const confirmPassword = elements.confirmNewPasswordInput.value;

    if (newPassword.length < 8) {
      showToast("New password must be at least 8 characters.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Password confirmation does not match.", true);
      return;
    }

    elements.changePasswordBtn.disabled = true;

    try {
      const token = await window.FiDaCommon.getRequiredSessionToken();
      const client = window.FiDaCommon.getSupabaseClient();
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(error.message || "Password update failed.");
      }

      await window.FiDaCommon.rewrapProfileEncryptionForNewPassword(token, newPassword);
      elements.passwordForm.reset();
      showToast("Password updated successfully.", false);
    } catch (error) {
      showToast(error.message || "Could not update password.", true);
    } finally {
      elements.changePasswordBtn.disabled = false;
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

  elements.globalThemeSelect.value = settings.active_theme;
  applyThemePreview(settings.active_theme);

  const config = window.FiDaCommon.getConfig();
  window.FiDaCommon.setBaseUrl(config.baseUrl);

  elements.globalThemeSelect.addEventListener("change", (event) => {
    persistTheme(event.currentTarget.value, false);
  });
  elements.profileForm?.addEventListener("submit", handleProfileUpdate);
  elements.passwordForm?.addEventListener("submit", handlePasswordChange);
  elements.accountSetupForm?.addEventListener("submit", handleAccountSetup);
  elements.settingsAccountsBody?.addEventListener("click", handleAccountRemove);
  elements.openAccountModalBtn?.addEventListener("click", openAccountModal);
  elements.closeAccountModalBtn?.addEventListener("click", closeAccountModal);
  elements.cancelAccountModalBtn?.addEventListener("click", closeAccountModal);
  elements.accountModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === elements.accountModalBackdrop) {
      closeAccountModal();
    }
  });
  elements.closeDeleteAccountModalBtn?.addEventListener("click", closeDeleteAccountModal);
  elements.cancelDeleteAccountModalBtn?.addEventListener("click", closeDeleteAccountModal);
  elements.confirmDeleteAccountBtn?.addEventListener("click", handleConfirmDeleteAccount);
  elements.deleteAccountModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === elements.deleteAccountModalBackdrop) {
      closeDeleteAccountModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.accountModalBackdrop && !elements.accountModalBackdrop.hidden) {
      closeAccountModal();
      return;
    }
    if (event.key === "Escape" && elements.deleteAccountModalBackdrop && !elements.deleteAccountModalBackdrop.hidden) {
      closeDeleteAccountModal();
    }
  });
  elements.logoutBtn?.addEventListener("click", handleLogout);

  loadProfile();
})();
