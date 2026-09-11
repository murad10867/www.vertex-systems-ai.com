(function () {
  "use strict";

  const statusIcon = document.getElementById("statusIcon");
  const statusTitle = document.getElementById("statusTitle");
  const statusText = document.getElementById("statusText");
  const resultBox = document.getElementById("resultBox");

  function showResult(type, title, text) {
    statusIcon.textContent = type === "success" ? "✅" : type === "setup" ? "⚙️" : "❌";
    statusTitle.textContent = title;
    statusText.textContent = text;
    resultBox.hidden = false;
    resultBox.className = type === "success" ? "success-box" : type === "setup" ? "setup-message" : "error-box";
    resultBox.textContent = text;
  }

  function planLabel(plan) {
    return plan === "plus" ? "Plus" : plan === "pro" ? "Pro" : "Free";
  }

  async function verifyPayment() {
    try {
      if (window.VertexAuth?.init) await window.VertexAuth.init();

      const client = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
      if (!client?.auth) {
        showResult("error", "تعذر التحقق", "لم يتم الاتصال بحساب Vertex. أعد تحميل الصفحة.");
        return;
      }

      const sessionResult = await client.auth.getSession();
      const session = sessionResult?.data?.session;
      if (!session?.user) {
        localStorage.setItem("vertexReturnPage", "payment-result.html");
        window.location.replace("login.html");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const paymentId = params.get("id");
      if (!paymentId) {
        showResult("error", "لا توجد عملية دفع", "لم يصل رقم عملية الدفع من Moyasar.");
        return;
      }

      const { data, error } = await client.functions.invoke("vertex-moyasar-verify", {
        body: { payment_id: paymentId }
      });

      if (error) {
        const message = String(error.message || "");
        if (message.includes("503") || data?.error === "moyasar_not_configured") {
          showResult("setup", "باقي ربط مفتاح Moyasar السري", "بنية الدفع جاهزة، لكن مفتاح Moyasar السري لم يُضف إلى Supabase بعد.");
          return;
        }
        throw error;
      }

      if (!data?.success) {
        if (data?.error === "moyasar_not_configured") {
          showResult("setup", "باقي ربط Moyasar", "أضف مفاتيح Moyasar الاختبارية لإكمال التحقق وتفعيل الاشتراك.");
          return;
        }
        showResult("error", "لم يتم تفعيل الاشتراك", "لم نستطع تأكيد أن العملية مدفوعة بالكامل. لم يتم تغيير خطتك.");
        return;
      }

      localStorage.removeItem("vertexSelectedPlan");
      const label = planLabel(data.plan);
      const expiry = data.current_period_end
        ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date(data.current_period_end))
        : "بعد شهر";

      showResult("success", "تم تفعيل Vertex " + label + " 🎉", "تم التحقق من الدفع بنجاح. اشتراكك فعال حتى " + expiry + ".");
    } catch (error) {
      console.error("Vertex payment verification error:", error);
      showResult("error", "تعذر التحقق من الدفع", "لم نفعّل الاشتراك لأن التحقق من الخادم لم يكتمل. يمكنك إعادة فتح هذه الصفحة بنفس رابط العملية لاحقًا.");
    }
  }

  verifyPayment();
})();