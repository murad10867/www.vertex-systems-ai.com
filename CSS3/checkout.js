(function () {
  "use strict";

  const setupMessage = document.getElementById("setupMessage");
  const checkoutError = document.getElementById("checkoutError");
  const planName = document.getElementById("planName");
  const planPrice = document.getElementById("planPrice");
  const planDescription = document.getElementById("planDescription");
  const moyasarForm = document.getElementById("moyasarForm");
  const promoCode = document.getElementById("promoCode");
  const redeemPromoBtn = document.getElementById("redeemPromoBtn");
  const promoMessage = document.getElementById("promoMessage");

  let activeClient = null;
  let activePlan = "pro";

  function clearMessages() {
    if (setupMessage) {
      setupMessage.hidden = true;
      setupMessage.textContent = "";
    }
    if (checkoutError) {
      checkoutError.hidden = true;
      checkoutError.textContent = "";
    }
  }

  function showSetup(message) {
    if (!setupMessage) return;
    setupMessage.hidden = false;
    setupMessage.textContent = message;
  }

  function hideSetup() {
    if (!setupMessage) return;
    setupMessage.hidden = true;
    setupMessage.textContent = "";
  }

  function showError(message) {
    hideSetup();
    if (!checkoutError) return;
    checkoutError.hidden = false;
    checkoutError.textContent = message;
  }

  function showPromoMessage(message, type) {
    if (!promoMessage) return;
    promoMessage.hidden = false;
    promoMessage.className = "promo-message " + (type === "success" ? "promo-success" : "promo-error");
    promoMessage.textContent = message;
  }

  function getSelectedPlan() {
    const queryPlan = new URLSearchParams(window.location.search).get("plan");
    const storedPlan = localStorage.getItem("vertexSelectedPlan");
    const plan = queryPlan || storedPlan || "pro";
    return plan === "plus" ? "plus" : "pro";
  }

  function subscriptionName(plan) {
    return plan === "plus" ? "Vertex AI Plus" : "Vertex AI Pro";
  }

  async function parseFunctionError(error, data) {
    if (data && typeof data === "object") return data;
    try {
      const response = error?.context;
      if (response && typeof response.json === "function") {
        return await response.json();
      }
    } catch (_) {}
    return null;
  }

  async function redeemPromo() {
    if (!activeClient || !promoCode || !redeemPromoBtn) return;

    const code = String(promoCode.value || "").trim();
    if (!code) {
      showPromoMessage("اكتب كود البطاقة أولًا.", "error");
      promoCode.focus();
      return;
    }

    redeemPromoBtn.disabled = true;
    redeemPromoBtn.textContent = "جاري التفعيل...";
    if (promoMessage) promoMessage.hidden = true;

    try {
      const { data, error } = await activeClient.functions.invoke("vertex-promo-redeem", {
        body: { code, plan: activePlan }
      });

      if (error) {
        const payload = await parseFunctionError(error, data);
        if (payload?.error === "promo_already_used") {
          showPromoMessage("تم استخدام هذا الكود على حسابك من قبل.", "error");
        } else if (payload?.error === "invalid_promo_code") {
          showPromoMessage("كود البطاقة غير صحيح.", "error");
        } else {
          showPromoMessage("تعذر تفعيل الكود الآن. جرّب مرة أخرى.", "error");
        }
        return;
      }

      if (!data?.success) {
        showPromoMessage(data?.message || "تعذر تفعيل الكود.", "error");
        return;
      }

      const label = data.plan === "plus" ? "Plus" : "Pro";
      const expiry = data.current_period_end
        ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date(data.current_period_end))
        : "بعد شهر";

      localStorage.removeItem("vertexSelectedPlan");
      clearMessages();
      if (moyasarForm) moyasarForm.hidden = true;
      promoCode.disabled = true;
      redeemPromoBtn.textContent = "تم التفعيل ✓";
      showPromoMessage("تم تفعيل Vertex AI " + label + " مجانًا. اشتراكك فعال حتى " + expiry + ".", "success");
    } catch (error) {
      console.error("Vertex promo redemption error:", error);
      showPromoMessage("حدث خطأ أثناء تفعيل الكود. جرّب مرة أخرى.", "error");
    } finally {
      if (!promoCode.disabled) {
        redeemPromoBtn.disabled = false;
        redeemPromoBtn.textContent = "تفعيل مجاني";
      }
    }
  }

  async function initCheckout() {
    clearMessages();

    const billing = window.VERTEX_BILLING;
    const selectedPlan = getSelectedPlan();
    const plan = billing?.plans?.[selectedPlan];
    activePlan = selectedPlan;

    if (!billing || !plan) {
      showError("تعذر تحميل إعدادات الاشتراك.");
      return;
    }

    const displayName = subscriptionName(selectedPlan);
    planName.textContent = displayName;
    planPrice.textContent = String(plan.amountHalalas / 100);
    planDescription.textContent = selectedPlan === "plus"
      ? "اشتراك Vertex AI Plus بأعلى حدود الاستخدام."
      : "اشتراك Vertex AI Pro للاستخدام المستمر والمزايا المتقدمة.";

    try {
      if (window.VertexAuth?.init) await window.VertexAuth.init();

      const client = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
      if (!client?.auth) {
        showError("تعذر الاتصال بحساب Vertex. أعد تحميل الصفحة.");
        return;
      }

      activeClient = client;

      const sessionResult = await client.auth.getSession();
      const session = sessionResult?.data?.session;
      if (!session?.user) {
        localStorage.setItem("vertexReturnPage", "plans.html");
        window.location.replace("login.html");
        return;
      }

      localStorage.setItem("vertexSelectedPlan", selectedPlan);

      const publishableKey = String(billing.moyasarPublishableKey || "").trim();
      if (!publishableKey) {
        showSetup("صفحة الدفع جاهزة، لكن مفتاح Moyasar العام غير مضاف بعد.");
        return;
      }

      if (!/^pk_(test|live)_/i.test(publishableKey)) {
        showError("مفتاح Moyasar العام غير صحيح.");
        return;
      }

      if (!window.Moyasar?.init) {
        showError("تعذر تحميل نموذج Moyasar. أعد تحميل الصفحة أو تحقق من الاتصال بالإنترنت.");
        return;
      }

      if (!moyasarForm) {
        showError("تعذر العثور على مكان نموذج الدفع في الصفحة.");
        return;
      }

      showSetup(publishableKey.startsWith("pk_test_")
        ? "🧪 جاري تحميل نموذج الدفع التجريبي..."
        : "جاري تحميل نموذج الدفع...");

      moyasarForm.innerHTML = "";
      moyasarForm.hidden = false;
      const callbackUrl = new URL("payment-result.html", window.location.href).href;

      const initResult = window.Moyasar.init({
        element: moyasarForm,
        amount: plan.amountHalalas,
        currency: billing.currency || "SAR",
        description: displayName + " monthly subscription",
        publishable_api_key: publishableKey,
        callback_url: callbackUrl,
        supported_networks: ["mada", "visa", "mastercard"],
        methods: ["creditcard"],
        language: "ar",
        fixed_width: false,
        metadata: {
          vertex_plan: selectedPlan,
          vertex_user_id: session.user.id
        },
        on_failure: function (error) {
          console.error("Moyasar form failure:", error);
          showError("تعذر بدء عملية الدفع عبر Moyasar. جرّب إعادة تحميل الصفحة.");
        }
      });

      if (initResult && typeof initResult.then === "function") {
        await initResult;
      }

      setTimeout(function () {
        if (moyasarForm.children.length) {
          hideSetup();
          return;
        }
        if (checkoutError?.hidden !== false) {
          showError("لم يظهر نموذج الدفع من Moyasar. أعد تحميل الصفحة مرة واحدة، وإذا استمر أرسل لنا هذه الشاشة.");
        }
      }, 1800);
    } catch (error) {
      console.error("Vertex checkout error:", error);
      showError("حدث خطأ أثناء تجهيز الدفع. أعد المحاولة.");
    }
  }

  redeemPromoBtn?.addEventListener("click", redeemPromo);
  promoCode?.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      redeemPromo();
    }
  });

  initCheckout();
})();