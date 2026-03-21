(function bootstrapRegisterPage() {
  document.body.setAttribute("data-theme", "light");

  const elements = {
    form: document.getElementById("registerForm"),
    nameInput: document.getElementById("nameInput"),
    emailInput: document.getElementById("emailInput"),
    countryInput: document.getElementById("countryInput"),
    passwordInput: document.getElementById("passwordInput"),
    confirmPasswordInput: document.getElementById("confirmPasswordInput"),
    registerBtn: document.getElementById("registerBtn"),
    statusMessage: document.getElementById("statusMessage")
  };

  if (!elements.form) {
    return;
  }

  function setStatus(message, isError) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.classList.toggle("status-error", Boolean(isError));
    elements.statusMessage.classList.toggle("status-ok", !isError);
  }

  async function redirectIfAuthenticated() {
    try {
      const token = await window.FiDaCommon.getSessionToken();
      if (token) {
        window.location.replace("index.html");
      }
    } catch {
      setStatus("Session check failed. You can still register.", true);
    }
  }

  async function setProfileDetails(token, fullName, country) {
    try {
      const baseUrl = window.FiDaCommon.DEFAULTS.baseUrl;
      const url = `http://${baseUrl}/v1/profile`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ full_name: fullName, country })
      });

      if (!response.ok) {
        console.warn("Failed to save profile details, but signup succeeded.");
      }
    } catch (error) {
      console.warn("Could not save profile details:", error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const fullName = elements.nameInput.value.trim();
    const email = elements.emailInput.value.trim();
    const country = String(elements.countryInput?.value || "").trim().toUpperCase();
    const password = elements.passwordInput.value;
    const confirmPassword = elements.confirmPasswordInput.value;

    if (!fullName || !email || !country || !password || !confirmPassword) {
      setStatus("All fields are required.", true);
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.", true);
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Password and confirm password must match.", true);
      return;
    }

    elements.registerBtn.disabled = true;
    setStatus("Creating account...", false);

    try {
      const client = window.FiDaCommon.getSupabaseClient();
      const { data, error } = await client.auth.signUp({ email, password });

      if (error) {
        throw new Error(error.message || "Registration failed.");
      }

      window.FiDaCommon.setEmail(email);
      window.FiDaCommon.setBaseUrl(window.FiDaCommon.DEFAULTS.baseUrl);

      const token = data?.session?.access_token;
      if (token) {
        await window.FiDaCommon.initializeEncryptionForSession(token, password);
        await setProfileDetails(token, fullName, country);
        setStatus("Registration successful. Redirecting to dashboard...", false);
        window.location.replace("index.html");
        return;
      }

      const message = encodeURIComponent("Registration successful. Check your email to verify, then login.");
      window.location.replace(`login.html?message=${message}`);
    } catch (error) {
      setStatus(error.message || "Unable to register.", true);
    } finally {
      elements.registerBtn.disabled = false;
    }
  }

  elements.emailInput.value = window.FiDaCommon.getEmail();
  elements.form.addEventListener("submit", handleSubmit);
  redirectIfAuthenticated();
})();