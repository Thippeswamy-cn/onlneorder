const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isFlaskOrigin = ["5000", "80", "443", ""].includes(window.location.port)
    && window.location.protocol !== "file:";
const API_URL = window.AUTH_API_URL
    || (isFlaskOrigin ? "/api" : "http://127.0.0.1:5000/api");

function setError(input, message) {
    const error = document.getElementById(`${input.id}-error`);
    input.classList.toggle("invalid", Boolean(message));
    input.setAttribute("aria-invalid", Boolean(message));
    if (error) error.textContent = message;
}

function validateRequired(input, label) {
    const value = input.value.trim();
    let message = "";
    if (!value) message = `${label} is required.`;
    else if (input.type === "email" && !emailPattern.test(value)) message = "Enter a valid email address.";
    else if (input.minLength > 0 && value.length < input.minLength) {
        message = `${label} must be at least ${input.minLength} characters.`;
    }
    setError(input, message);
    return !message;
}

async function apiRequest(path, body) {
    try {
        const response = await fetch(`${API_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Something went wrong.");
        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error("Cannot connect to Flask. Run: python backend/app.py");
        }
        throw error;
    }
}

function setButtonLoading(button, loading, loadingText = "Loading…") {
    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.classList.add("button-loading");
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.classList.remove("button-loading");
        button.disabled = false;
        button.removeAttribute("aria-busy");
    }
}

document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "Hide" : "Show";
        button.setAttribute("aria-label", `${show ? "Hide" : "Show"} password`);
    });
});

document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
        if (input.classList.contains("invalid")) setError(input, "");
    });
});

document.querySelectorAll("[data-service-carousel]").forEach((carousel) => {
    const slides = [...carousel.querySelectorAll("[data-slide]")];
    const dots = carousel.querySelector(".carousel-dots");
    let activeIndex = 0;
    let timer;

    slides.forEach((slide, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Show service ${index + 1}`);
        dot.addEventListener("click", () => showSlide(index, true));
        dots.appendChild(dot);
        slide.addEventListener("click", () => {
            if (slide.classList.contains("is-prev")) showSlide(activeIndex - 1, true);
            if (slide.classList.contains("is-next")) showSlide(activeIndex + 1, true);
        });
    });

    function showSlide(index, restart = false) {
        activeIndex = (index + slides.length) % slides.length;
        const previous = (activeIndex - 1 + slides.length) % slides.length;
        const next = (activeIndex + 1) % slides.length;
        slides.forEach((slide, slideIndex) => {
            slide.classList.toggle("is-active", slideIndex === activeIndex);
            slide.classList.toggle("is-prev", slideIndex === previous);
            slide.classList.toggle("is-next", slideIndex === next);
        });
        [...dots.children].forEach((dot, dotIndex) => {
            dot.classList.toggle("active", dotIndex === activeIndex);
            dot.setAttribute("aria-current", dotIndex === activeIndex ? "true" : "false");
        });
        if (restart) startAutoplay();
    }

    function startAutoplay() {
        clearInterval(timer);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            timer = setInterval(() => showSlide(activeIndex + 1), 3200);
        }
    }

    carousel.querySelector(".carousel-prev").addEventListener("click", () => showSlide(activeIndex - 1, true));
    carousel.querySelector(".carousel-next").addEventListener("click", () => showSlide(activeIndex + 1, true));
    carousel.addEventListener("mouseenter", () => clearInterval(timer));
    carousel.addEventListener("mouseleave", startAutoplay);
    showSlide(0);
    startAutoplay();
});

const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("email");
        const password = document.getElementById("password");
        const valid = validateRequired(email, "Email") & validateRequired(password, "Password");
        if (!valid) return;

        const message = document.getElementById("form-message");
        const submit = loginForm.querySelector('[type="submit"]');
        setButtonLoading(submit, true, "Signing in…");
        message.textContent = "Signing in…";
        try {
            const data = await apiRequest("/login", {
                email: email.value.trim(),
                password: password.value
            });
            message.textContent = data.message;
            localStorage.setItem("localConnectUser", data.name || "User");
            localStorage.setItem("localConnectProfile", JSON.stringify({
                name: data.name || "User",
                email: email.value.trim()
            }));
            setTimeout(() => {
                window.location.href = "home.html";
            }, 700);
        } catch (error) {
            message.textContent = error.message;
        } finally {
            setButtonLoading(submit, false);
        }
    });
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
    const email = document.getElementById("email");
    const otp = document.getElementById("otp");
    const message = document.getElementById("form-message");
    let verificationToken = "";
    let isVerifyingOtp = false;

    async function sendOtp(triggerButton) {
        if (!validateRequired(email, "Email")) return;
        const button = triggerButton || document.getElementById("send-otp");
        setButtonLoading(button, true, button.id === "resend-otp" ? "Resending…" : "Sending…");
        message.textContent = "Sending verification code…";
        try {
            const data = await apiRequest("/send-otp", { email: email.value.trim() });
            document.getElementById("otp-group").classList.remove("hidden");
            email.readOnly = true;
            message.textContent = data.message;
            otp.value = "";
            setError(otp, "");
            otp.focus();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            setButtonLoading(button, false);
        }
    }

    document.getElementById("send-otp").addEventListener("click", (event) => sendOtp(event.currentTarget));
    document.getElementById("resend-otp").addEventListener("click", async (event) => {
        await sendOtp(event.currentTarget);
    });

    async function verifyOtp() {
        if (isVerifyingOtp) return;
        otp.value = otp.value.replace(/\D/g, "").slice(0, 6);
        if (!/^\d{6}$/.test(otp.value)) {
            setError(otp, "Enter the complete 6-digit code.");
            return;
        }
        const button = document.getElementById("verify-otp");
        isVerifyingOtp = true;
        setButtonLoading(button, true, "Verifying…");
        message.textContent = "Verifying code…";
        try {
            const data = await apiRequest("/verify-otp", {
                email: email.value.trim(),
                otp: otp.value
            });
            verificationToken = data.verificationToken;
            document.getElementById("email-step").classList.add("hidden");
            document.getElementById("account-step").classList.remove("hidden");
            document.getElementById("verified-email-address").textContent = email.value.trim();
            document.getElementById("step-description").textContent = "Your email is verified. Finish creating your account.";
            message.textContent = "";
            document.getElementById("name").focus();
        } catch (error) {
            setError(otp, error.message);
            message.textContent = "";
            setButtonLoading(button, false);
            isVerifyingOtp = false;
        }
    }

    otp.addEventListener("input", () => {
        otp.value = otp.value.replace(/\D/g, "").slice(0, 6);
        if (otp.classList.contains("invalid")) setError(otp, "");
        if (otp.value.length === 6) verifyOtp();
    });

    document.getElementById("verify-otp").addEventListener("click", verifyOtp);

    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = document.getElementById("name");
        const password = document.getElementById("password");
        const confirmPassword = document.getElementById("confirm-password");
        const terms = document.getElementById("terms");
        let valid = true;
        valid = validateRequired(name, "Full name") && valid;
        valid = validateRequired(password, "Password") && valid;
        valid = validateRequired(confirmPassword, "Password confirmation") && valid;
        if (confirmPassword.value && password.value !== confirmPassword.value) {
            setError(confirmPassword, "Passwords do not match.");
            valid = false;
        }
        document.getElementById("terms-error").textContent =
            terms.checked ? "" : "Please accept the terms to continue.";
        valid = terms.checked && valid;
        if (!valid) return;

        const submit = signupForm.querySelector('[type="submit"]');
        setButtonLoading(submit, true, "Creating account…");
        message.textContent = "Creating your account…";
        try {
            const data = await apiRequest("/create-account", {
                email: email.value.trim(),
                name: name.value.trim(),
                password: password.value,
                verificationToken
            });
            message.textContent = data.message;
            localStorage.setItem("localConnectUser", name.value.trim());
            localStorage.setItem("localConnectProfile", JSON.stringify({
                name: name.value.trim(),
                email: email.value.trim()
            }));
            setTimeout(() => { window.location.href = "home.html"; }, 900);
        } catch (error) {
            message.textContent = error.message;
            setButtonLoading(submit, false);
        }
    });
}
