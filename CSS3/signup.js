// ==========================================
// Vertex Systems AI - Supabase Signup
// ==========================================

"use strict";

const signupForm = document.getElementById("signupForm");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const confirmPasswordInput = document.getElementById("confirmPasswordInput");
const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const toggleConfirmPasswordBtn = document.getElementById("toggleConfirmPasswordBtn");
const homeBtn = document.getElementById("homeBtn");
const backHomeBtn = document.getElementById("backHomeBtn");
const backLoginBtn = document.getElementById("backLoginBtn");
const particles = document.getElementById("particles");

// إزالة أي جلسة محلية قديمة من النظام السابق.
localStorage.removeItem("vertexSession");

function isSupabaseReady() {
    return typeof supabaseClient !== "undefined" && supabaseClient && supabaseClient.auth;
}

function goHome() {
    window.location.href = "index.html";
}

homeBtn?.addEventListener("click", goHome);
backHomeBtn?.addEventListener("click", goHome);
backLoginBtn?.addEventListener("click", function () {
    window.location.href = "login.html";
});

function togglePassword(input, button) {
    if (!input || !button) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "🙈" : "👁️";
    button.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
}

togglePasswordBtn?.addEventListener("click", function () {
    togglePassword(passwordInput, togglePasswordBtn);
});

toggleConfirmPasswordBtn?.addEventListener("click", function () {
    togglePassword(confirmPasswordInput, toggleConfirmPasswordBtn);
});

function clearErrors() {
    if (nameError) nameError.textContent = "";
    if (emailError) emailError.textContent = "";
    if (passwordError) passwordError.textContent = "";
    if (confirmPasswordError) confirmPasswordError.textContent = "";

    document.querySelectorAll(".input-wrapper").forEach(function (wrapper) {
        wrapper.classList.remove("error");
    });
}

function showFieldError(input, errorElement, message) {
    if (errorElement) errorElement.textContent = message;
    const wrapper = input?.closest(".input-wrapper");
    if (wrapper) wrapper.classList.add("error");
}

function showFormMessage(message, type) {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.className = "form-message visible " + type;
}

function hideFormMessage() {
    if (!formMessage) return;
    formMessage.textContent = "";
    formMessage.className = "form-message";
}

function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("loading", loading);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
    return (
        password.length >= 12 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password)
    );
}

function validateForm() {
    clearErrors();

    const name = nameInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";
    let valid = true;

    if (name.length < 2) {
        showFieldError(nameInput, nameError, "اكتب اسمًا من حرفين على الأقل.");
        valid = false;
    }

    if (!email) {
        showFieldError(emailInput, emailError, "اكتب البريد الإلكتروني.");
        valid = false;
    } else if (!isValidEmail(email)) {
        showFieldError(emailInput, emailError, "صيغة البريد الإلكتروني غير صحيحة.");
        valid = false;
    }

    if (!isStrongPassword(password)) {
        showFieldError(
            passwordInput,
            passwordError,
            "استخدم 12 حرفًا على الأقل، وحرفًا كبيرًا وصغيرًا ورقمًا ورمزًا."
        );
        valid = false;
    }

    if (!confirmPassword) {
        showFieldError(confirmPasswordInput, confirmPasswordError, "أعد كتابة كلمة المرور.");
        valid = false;
    } else if (confirmPassword !== password) {
        showFieldError(confirmPasswordInput, confirmPasswordError, "كلمتا المرور غير متطابقتين.");
        valid = false;
    }

    return valid;
}

function getFriendlySignupError(error) {
    const message = String(error?.message || "").toLowerCase();

    if (
        message.includes("already registered") ||
        message.includes("already been registered") ||
        message.includes("user already registered")
    ) {
        return "هذا البريد مسجل بالفعل. استخدم صفحة تسجيل الدخول.";
    }

    if (message.includes("password")) {
        return "كلمة المرور لا تحقق شروط الأمان المطلوبة.";
    }

    if (message.includes("rate limit") || message.includes("too many requests")) {
        return "تمت محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.";
    }

    if (message.includes("failed to fetch") || message.includes("network")) {
        return "تعذر الاتصال بالخادم. تأكد من الإنترنت ثم حاول مرة أخرى.";
    }

    return "تعذر إنشاء الحساب الآن. حاول مرة أخرى.";
}

function getDestinationPage() {
    const requestedSystem = localStorage.getItem("vertexRequestedSystem");
    const systems = {
        ai: "ai.html",
        robots: "robots.html",
        games: "games.html",
        web: "web.html",
        space: "space.html"
    };

    if (requestedSystem && systems[requestedSystem]) {
        return systems[requestedSystem];
    }

    const returnPage = localStorage.getItem("vertexReturnPage");
    if (
        returnPage &&
        /^[a-zA-Z0-9_-]+\.html$/.test(returnPage) &&
        returnPage !== "login.html" &&
        returnPage !== "signup.html" &&
        returnPage !== "index.html"
    ) {
        return returnPage;
    }

    return "dashboard.html";
}

signupForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideFormMessage();

    if (!isSupabaseReady()) {
        showFormMessage("❌ تعذر الاتصال بنظام الحسابات. أعد تحميل الصفحة وحاول مرة أخرى.", "error");
        return;
    }

    if (!validateForm()) {
        showFormMessage("⚠️ تأكد من البيانات المكتوبة.", "error");
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    setLoading(true);

    try {
        const emailRedirectTo = new URL("login.html", window.location.href).href;
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name, name },
                emailRedirectTo
            }
        });

        if (error) throw error;
        if (!data.user) throw new Error("No user returned from Supabase");

        if (data.session) {
            showFormMessage("✅ تم إنشاء الحساب وتسجيل الدخول بنجاح.", "success");

            setTimeout(function () {
                const destination = getDestinationPage();
                localStorage.removeItem("vertexRequestedSystem");
                localStorage.removeItem("vertexReturnPage");
                window.location.href = destination;
            }, 700);
            return;
        }

        showFormMessage(
            "✅ تم إنشاء الحساب. افتح بريدك الإلكتروني واضغط رابط تأكيد الحساب، ثم ارجع وسجّل الدخول.",
            "success"
        );

        if (backLoginBtn) backLoginBtn.textContent = "تم تأكيد البريد — تسجيل الدخول";
        passwordInput.value = "";
        confirmPasswordInput.value = "";
        backLoginBtn?.focus();
    } catch (error) {
        console.error("Vertex signup error:", error);
        showFormMessage("❌ " + getFriendlySignupError(error), "error");
    } finally {
        setLoading(false);
    }
});

[nameInput, emailInput, passwordInput, confirmPasswordInput].forEach(function (input) {
    input?.addEventListener("input", function () {
        input.closest(".input-wrapper")?.classList.remove("error");
        hideFormMessage();
    });
});

function createParticles() {
    if (!particles) return;

    for (let i = 0; i < 45; i++) {
        const particle = document.createElement("span");
        particle.className = "particle";
        particle.style.left = Math.random() * 100 + "%";
        particle.style.top = Math.random() * 100 + "%";
        particle.style.setProperty("--duration", 2 + Math.random() * 5 + "s");
        particle.style.setProperty("--delay", Math.random() * -5 + "s");
        particles.appendChild(particle);
    }
}

createParticles();