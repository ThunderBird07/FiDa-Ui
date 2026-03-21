(function bootstrapLoginPage() {
  const elements = {
    form: document.getElementById("loginForm"),
    emailInput: document.getElementById("emailInput"),
    passwordInput: document.getElementById("passwordInput"),
    loginBtn: document.getElementById("loginBtn"),
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

  function readQueryMessage() {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("message");
    return value ? decodeURIComponent(value) : "";
  }

  async function redirectIfAuthenticated() {
    try {
      const token = await window.FiDaCommon.getSessionToken();
      if (token) {
        window.location.replace("index.html");
      }
    } catch {
      setStatus("Session check failed. Please sign in.", true);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!email || !password) {
      setStatus("Email and password are required.", true);
      return;
    }

    elements.loginBtn.disabled = true;
    setStatus("Signing in...", false);

    try {
      const client = window.FiDaCommon.getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        throw new Error(error.message || "Login failed.");
      }

      const token = data?.session?.access_token;
      if (!token) {
        throw new Error("Login succeeded but no access token was returned.");
      }

      window.FiDaCommon.setEmail(email);
      window.FiDaCommon.setBaseUrl(window.FiDaCommon.DEFAULTS.baseUrl);
      setStatus("Login successful. Redirecting...", false);
      window.location.replace("index.html");
    } catch (error) {
      setStatus(error.message || "Unable to login.", true);
    } finally {
      elements.loginBtn.disabled = false;
    }
  }

  elements.emailInput.value = window.FiDaCommon.getEmail();
  elements.form.addEventListener("submit", handleSubmit);

  const queryMessage = readQueryMessage();
  if (queryMessage) {
    setStatus(queryMessage, false);
  }

  redirectIfAuthenticated();
})();