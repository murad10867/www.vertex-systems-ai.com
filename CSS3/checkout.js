(function () {
  "use strict";

  const setupMessage = document.getElementById("setupMessage");
  const checkoutError = document.getElementById("checkoutError");
  const planName = document.getElementById("planName");
  const planPrice = document.getElementById("planPrice");
  const planDescription = document.getElementById("planDescription");
  const moyasarForm = document.getElementById("moyasarForm");

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

  function showError(message) {
    if (!checkoutError) return;
    checkoutError.hidden = false;
    checkoutError.textContent = message;
  }

  function getSelectedPlan() {
    const queryPlan = new URLSearchParams(window.location.search).get("plan");
    const storedPlan = localStorage.getItem("vertexSelectedPlan");
    const plan = queryPlan || storedPlan || "pro";
    return plan === "plus" ? "plus" : "pro";
  }

  async function initCheckout() {
    clearMessages();

    const billing = window.VERTEX_BILLING;
    const selectedPlan = getSelectedPlan();
    const plan = billing?.plans?.[selectedPlan];

    if (!billing || !plan) {
      showError("تعذر تحميل إعدادات الاشتراك.");
      return;
    }

    planName.textContent = plan.name;
    planPrice.textContent = String(plan.amountHalalas / 100);
    planDescription.textContent = selectedPlan === "plus"
      ? "أعلى خطة في Vertex مع أعلى حدود الاستخدام."
      : "الخطة المتوسطة للاستخدام المستمر والمزايا المتقدمة.";

    try {
      if (window.VertexAuth?.init) await window.VertexAuth.init();

      const client = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
      if (!client?.auth) {
        showError("تعذر الاتصال بحساب Vertex. أعد تحميل الصفحة.");
        return;
      }

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

      moyasarForm.innerHTML = "";
      const callbackUrl = new URL("payment-result.html", window.location.href).href;

      const initResult = window.Moyasar.init({
        element: moyasarForm,
        amount: plan.amountHalalas,
        currency: billing.currency || "SAR",
        description: plan.name + " monthly subscription",
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
        if (!moyasarForm.children.length && !checkoutError?.hidden === false) {
          showError("لم يظهر نموذج الدفع من Moyasar. أعد تحميل الصفحة مرة واحدة، وإذا استمر أرسل لنا هذه الشاشة.");
        }
      }, 1800);
    } catch (error) {
      console.error("Vertex checkout error:", error);
      showError("حدث خطأ أثناء تجهيز الدفع. أعد المحاولة.");
    }
  }

  initCheckout();
})();