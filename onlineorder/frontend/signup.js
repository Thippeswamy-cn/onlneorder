document.querySelectorAll("[data-otp-gate]").forEach((gate) => {
  const apiBaseUrl = window.location.protocol === "file:" ? "http://localhost:3001" : "";
  const contactInput = gate.querySelector("[data-otp-contact]");
  const otpInput = gate.querySelector("[data-otp-input]");
  const sendButton = gate.querySelector("[data-send-otp]");
  const verifyButton = gate.querySelector("[data-verify-otp]");
  const message = gate.querySelector("[data-otp-message]");
  const formCard = gate.closest(".form-card");
  const signupFields = formCard.querySelector("[data-signup-fields]");
  let verifiedContact = "";

  function selectedMethod() {
    const fixedMethod = gate.dataset.otpMethod;
    const checkedMethod = gate.querySelector("input[type='radio']:checked");
    return fixedMethod || checkedMethod?.value || "email";
  }

  function updatePlaceholder() {
    const method = selectedMethod();
    contactInput.value = "";
    contactInput.placeholder = method === "mobile" ? "Enter mobile number" : "Enter email address";
    message.textContent = "";
  }

  gate.querySelectorAll("input[type='radio']").forEach((radio) => {
    radio.addEventListener("change", updatePlaceholder);
  });

  sendButton.addEventListener("click", () => {
    sendOtp();
  });

  verifyButton.addEventListener("click", () => {
    verifyOtp();
  });

  async function sendOtp() {
    const contact = contactInput.value.trim();
    const method = selectedMethod();
    const mobilePattern = /^\+[1-9]\d{7,14}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = method === "mobile" ? mobilePattern.test(contact) : emailPattern.test(contact);

    if (!isValid) {
      message.textContent = method === "mobile" ? "Enter mobile number with country code, example +919876543210." : "Enter a valid email address.";
      message.className = "otp-message error";
      return;
    }

    sendButton.disabled = true;
    message.textContent = "Sending OTP...";
    message.className = "otp-message";

    try {
      const response = await fetch(`${apiBaseUrl}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, contact, purpose: "signup" }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.deliveryError ? `${data.message} ${data.deliveryError}` : data.message);
      }

      verifiedContact = contact;
      otpInput.disabled = false;
      verifyButton.disabled = false;
      otpInput.value = data.otp || "";
      otpInput.focus();
      message.textContent = data.message;
      message.className = data.development ? "otp-message success" : "otp-message";
    } catch (error) {
      message.textContent = error.message || "Could not send OTP.";
      message.className = "otp-message error";
    } finally {
      sendButton.disabled = false;
    }
  }

  async function verifyOtp() {
    const method = selectedMethod();
    const otp = otpInput.value.trim();

    verifyButton.disabled = true;
    message.textContent = "Verifying OTP...";
    message.className = "otp-message";

    try {
      const response = await fetch(`${apiBaseUrl}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, contact: verifiedContact, otp, purpose: "signup" }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      gate.classList.add("verified");
      signupFields.disabled = false;
      const accountEmail = formCard.querySelector("input[type='email'][name='email']");
      if (accountEmail) {
        accountEmail.value = verifiedContact;
        accountEmail.readOnly = true;
      }
      contactInput.disabled = true;
      otpInput.disabled = true;
      sendButton.disabled = true;
      verifyButton.disabled = true;
      message.textContent = "OTP verified. You can complete signup now.";
      message.className = "otp-message success";
    } catch (error) {
      verifyButton.disabled = false;
      message.textContent = error.message || "Could not verify OTP.";
      message.className = "otp-message error";
    }
  }
});

const forgotPasswordButton = document.querySelector("#forgotPasswordButton");
if (forgotPasswordButton) {
  const apiBaseUrl = window.location.protocol === "file:" ? "http://localhost:3001" : "";
  const signinForm = document.querySelector("#signinForm");
  const signinMessage = document.querySelector("#signinMessage");
  const emailInput = signinForm?.querySelector("input[name='email']");
  const resetPanel = document.querySelector("[data-reset-panel]");
  const resetOtpInput = signinForm?.querySelector("input[name='resetOtp']");
  const verifyResetOtpButton = document.querySelector("#verifyResetOtpButton");
  const resetPasswordFields = document.querySelector("[data-reset-password-fields]");
  const updatePasswordButton = document.querySelector("#updatePasswordButton");
  const newPasswordInput = signinForm?.querySelector("input[name='newPassword']");
  const confirmPasswordInput = signinForm?.querySelector("input[name='confirmPassword']");
  let resetEmail = "";

  forgotPasswordButton.addEventListener("click", async () => {
    const email = emailInput?.value.trim() || "";

    if (!emailInput?.reportValidity()) {
      return;
    }

    const accounts = JSON.parse(localStorage.getItem("serviceBookingAccounts") || "[]");
    const account = accounts.find((item) => item.email.toLowerCase() === email.toLowerCase());

    if (!account) {
      signinMessage.textContent = "No account found for this email. Please sign up first.";
      signinMessage.className = "otp-message error";
      return;
    }

    forgotPasswordButton.disabled = true;
    resetPanel.hidden = false;
    resetOtpInput.disabled = true;
    verifyResetOtpButton.disabled = true;
    resetPasswordFields.hidden = true;
    resetPasswordFields.disabled = true;
    signinMessage.textContent = "Sending password reset OTP...";
    signinMessage.className = "otp-message";

    try {
      const response = await fetch(`${apiBaseUrl}/api/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "email", contact: email, purpose: "reset-password" }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.deliveryError ? `${data.message} ${data.deliveryError}` : data.message);
      }

      resetEmail = email;
      resetOtpInput.value = "";
      resetOtpInput.disabled = false;
      verifyResetOtpButton.disabled = false;
      resetOtpInput.focus();
      signinMessage.textContent = "Password reset OTP sent to your email.";
      signinMessage.className = "otp-message success";
    } catch (error) {
      signinMessage.textContent = error.message || "Could not send password reset OTP.";
      signinMessage.className = "otp-message error";
    } finally {
      forgotPasswordButton.disabled = false;
    }
  });

  resetOtpInput?.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
  });

  verifyResetOtpButton?.addEventListener("click", async () => {
    const otp = resetOtpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
      signinMessage.textContent = "Enter the 6-digit reset OTP.";
      signinMessage.className = "otp-message error";
      return;
    }

    verifyResetOtpButton.disabled = true;
    signinMessage.textContent = "Verifying reset OTP...";
    signinMessage.className = "otp-message";

    try {
      const response = await fetch(`${apiBaseUrl}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "email", contact: resetEmail, otp, purpose: "reset-password" }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      resetOtpInput.disabled = true;
      resetPasswordFields.hidden = false;
      resetPasswordFields.disabled = false;
      newPasswordInput.focus();
      signinMessage.textContent = "OTP verified. Enter your new password.";
      signinMessage.className = "otp-message success";
    } catch (error) {
      verifyResetOtpButton.disabled = false;
      signinMessage.textContent = error.message || "Could not verify reset OTP.";
      signinMessage.className = "otp-message error";
    }
  });

  updatePasswordButton?.addEventListener("click", () => {
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!newPasswordInput.reportValidity() || !confirmPasswordInput.reportValidity()) {
      return;
    }

    if (newPassword !== confirmPassword) {
      signinMessage.textContent = "New password and confirm password must match.";
      signinMessage.className = "otp-message error";
      return;
    }

    const accounts = JSON.parse(localStorage.getItem("serviceBookingAccounts") || "[]");
    const accountIndex = accounts.findIndex((item) => item.email.toLowerCase() === resetEmail.toLowerCase());

    if (accountIndex < 0) {
      signinMessage.textContent = "Account not found. Please sign up first.";
      signinMessage.className = "otp-message error";
      return;
    }

    accounts[accountIndex].password = newPassword;
    localStorage.setItem("serviceBookingAccounts", JSON.stringify(accounts));
    signinForm.querySelector("input[name='password']").value = "";
    resetPanel.hidden = true;
    forgotPasswordButton.disabled = false;
    signinMessage.textContent = "Password updated. Sign in with your new password.";
    signinMessage.className = "otp-message success";
  });
}

document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.id === "signinForm") {
      const formData = new FormData(form);
      const email = formData.get("email");
      const password = formData.get("password");
      const accounts = JSON.parse(localStorage.getItem("serviceBookingAccounts") || "[]");
      const account = accounts.find((item) => item.email === email && item.password === password);
      const message = document.querySelector("#signinMessage");

      if (!account) {
        message.textContent = "Invalid email or password.";
        message.className = "otp-message error";
        return;
      }

      localStorage.setItem("serviceBookingCurrentUser", JSON.stringify(account));
      message.textContent = `Signed in as ${account.type}.`;
      message.className = "otp-message success";
      return;
    }

    const accountType = form.id === "workerSignupForm" ? "worker" : "user";
    const formData = new FormData(form);
    const account = {
      type: accountType,
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      password: formData.get("password"),
    };
    const accounts = JSON.parse(localStorage.getItem("serviceBookingAccounts") || "[]");
    const existingIndex = accounts.findIndex((item) => item.email === account.email);

    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }

    localStorage.setItem("serviceBookingAccounts", JSON.stringify(accounts));
    alert(`${accountType === "worker" ? "Worker" : "User"} account created. Please sign in.`);
    window.location.href = "signin.html";
  });
});
