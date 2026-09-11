(function () {
  "use strict";

  const setupMessage = document.getElementById("setupMessage");
  const checkoutError = document.getElementById("checkoutError");
  const planName = document.getElementById("planName");
  const planPrice = document.getElementById("planPrice");
  const planDescription = document.getElementById("planDescription");

  function showSetup(message) {
    setupMessage.hidden = false;
    setupMessage.textContent = message;
  }

  function showError(message) {
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
        showSetup("✅ صفحة الدفع جاهزة. باقي ربط حساب Moyasar وإضافة مفتاح الاختبار العام pk_test لتظهر خانات الدفع هنا.");
        return;
      }

      if (!publishableKey.startsWith("pk_")) {
        showError("مفتاح Moyasar العام غير صحيح. يجب أن يبدأ بـ pk_.");
        return;
      }

      if (!window.Moyasar?.init) {
        showError("تعذر تحميل نموذج Moyasar. أعد تحميل الصفحة أو تحقق من الاتصال بالإنترنت.");
        return;
      }

      const callbackUrl = new URL("payment-result.html", window.location.href).href;

      window.Moyasar.init({
        element: "#moyasarForm",
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
        credit_card: {
          save_card: true
        }
      });
    } catch (error) {
      console.error("Vertex checkout error:", error);
      showError("حدث خطأ أثناء تجهيز الدفع. أعد المحاولة.");
    }
  }

  initCheckout();
})();