(function () {
  "use strict";

  const accountLink = document.getElementById("accountLink");
  const currentPlanBadge = document.getElementById("currentPlanBadge");
  const planButtons = Array.from(document.querySelectorAll("[data-select-plan]"));
  let session = null;
  let currentPlan = "free";

  function planLabel(plan) {
    if (plan === "plus") return "Plus";
    if (plan === "pro") return "Pro";
    return "Free";
  }

  function updatePlanUI() {
    if (currentPlanBadge && session) {
      currentPlanBadge.hidden = false;
      const strong = currentPlanBadge.querySelector("strong");
      if (strong) strong.textContent = planLabel(currentPlan);
    }

    planButtons.forEach(function (button) {
      const plan = button.dataset.selectPlan;
      const isCurrent = session && plan === currentPlan;

      if (isCurrent) {
        button.disabled = true;
        button.textContent = "خطتك الحالية";
      }
    });
  }

  async function loadAccount() {
    if (typeof supabaseClient === "undefined") return;

    try {
      const result = await supabaseClient.auth.getSession();
      session = result?.data?.session || null;

      if (!session?.user) {
        updatePlanUI();
        return;
      }

      if (accountLink) {
        accountLink.href = "dashboard.html";
        accountLink.textContent = "حسابي";
      }

      const subscriptionResult = await supabaseClient
        .from("vertex_subscriptions")
        .select("plan,status,current_period_end")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!subscriptionResult.error && subscriptionResult.data?.plan) {
        currentPlan = subscriptionResult.data.plan;
      }
    } catch (error) {
      console.warn("Could not load Vertex subscription:", error);
    }

    updatePlanUI();
  }

  planButtons.forEach(function (button) {
    button.addEventListener("click", async function () {
      const plan = button.dataset.selectPlan;

      if (plan === "free") {
        if (!session) {
          localStorage.setItem("vertexReturnPage", "plans.html");
          window.location.href = "login.html";
          return;
        }

        window.location.href = "dashboard.html";
        return;
      }

      if (!session) {
        localStorage.setItem("vertexReturnPage", "plans.html");
        localStorage.setItem("vertexSelectedPlan", plan);
        window.location.href = "login.html";
        return;
      }

      localStorage.setItem("vertexSelectedPlan", plan);
      window.location.href = "checkout.html?plan=" + encodeURIComponent(plan);
    });
  });

  loadAccount();
})();