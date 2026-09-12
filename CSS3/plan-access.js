// ==========================================
// Vertex plan access, quotas and upgrade UX
// ==========================================
(function () {
    "use strict";

    const GUARDED_FUNCTIONS = new Set([
        "vertex-ai",
        "vertex-ai-vision",
        "vertex-image",
        "vertex-github-plan",
        "vertex-github"
    ]);

    let client = null;
    let entitlements = null;
    let readyPromise = null;
    let invokePatched = false;

    function installStyles() {
        if (document.getElementById("vertexPlanAccessStyles")) return;

        const style = document.createElement("style");
        style.id = "vertexPlanAccessStyles";
        style.textContent = `
            .vertex-plan-badge {
                min-height: 34px;
                padding: 0 10px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(69,199,255,.24);
                border-radius: 10px;
                background: rgba(20,124,244,.09);
                color: #bdeaff;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: .03em;
                cursor: pointer;
                white-space: nowrap;
            }

            .vertex-plan-badge[data-plan="pro"] {
                border-color: rgba(56,189,248,.38);
                background: rgba(14,165,233,.13);
                color: #d8f6ff;
            }

            .vertex-plan-badge[data-plan="plus"] {
                border-color: rgba(167,139,250,.42);
                background: rgba(124,58,237,.16);
                color: #eee8ff;
            }

            .vertex-plan-modal {
                position: fixed;
                inset: 0;
                z-index: 200000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(2,6,15,.78);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
            }

            .vertex-plan-modal[hidden] { display: none !important; }

            .vertex-plan-card {
                width: min(430px, 100%);
                padding: 24px;
                border: 1px solid rgba(69,199,255,.18);
                border-radius: 22px;
                background: #08111f;
                box-shadow: 0 28px 80px rgba(0,0,0,.48);
                color: #f8fafc;
                direction: rtl;
                text-align: right;
            }

            .vertex-plan-card .vertex-plan-icon {
                width: 48px;
                height: 48px;
                display: grid;
                place-items: center;
                border-radius: 14px;
                background: rgba(37,99,235,.15);
                font-size: 23px;
                margin-bottom: 14px;
            }

            .vertex-plan-card h3 {
                margin: 0 0 8px;
                font-size: 21px;
            }

            .vertex-plan-card p {
                margin: 0;
                color: #9fb0c5;
                line-height: 1.8;
                font-size: 13px;
            }

            .vertex-plan-current {
                margin-top: 14px;
                padding: 10px 12px;
                border-radius: 10px;
                background: rgba(255,255,255,.035);
                color: #bdd0e4;
                font-size: 11px;
            }

            .vertex-plan-actions {
                margin-top: 18px;
                display: flex;
                gap: 9px;
                flex-wrap: wrap;
            }

            .vertex-plan-actions button,
            .vertex-plan-actions a {
                min-height: 40px;
                padding: 0 15px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                text-decoration: none;
                cursor: pointer;
                font-weight: 800;
                font-size: 12px;
            }

            .vertex-plan-upgrade {
                border: 1px solid rgba(56,189,248,.35);
                background: linear-gradient(135deg, #147cf4, #20a7dc);
                color: white;
            }

            .vertex-plan-close {
                border: 1px solid rgba(255,255,255,.09);
                background: rgba(255,255,255,.04);
                color: #d7e3f0;
            }
        `;
        document.head.appendChild(style);
    }

    function planLabel(plan) {
        if (plan === "plus") return "Plus";
        if (plan === "pro") return "Pro";
        return "Free";
    }

    function ensureModal() {
        let modal = document.getElementById("vertexPlanModal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "vertexPlanModal";
        modal.className = "vertex-plan-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <section class="vertex-plan-card" role="dialog" aria-modal="true" aria-labelledby="vertexPlanModalTitle">
                <div class="vertex-plan-icon" id="vertexPlanModalIcon">⬆️</div>
                <h3 id="vertexPlanModalTitle">ترقية الخطة</h3>
                <p id="vertexPlanModalMessage"></p>
                <div id="vertexPlanModalCurrent" class="vertex-plan-current"></div>
                <div class="vertex-plan-actions">
                    <a id="vertexPlanUpgradeLink" class="vertex-plan-upgrade" href="plans.html">عرض الخطط</a>
                    <button id="vertexPlanCloseBtn" class="vertex-plan-close" type="button">إغلاق</button>
                </div>
            </section>
        `;
        document.body.appendChild(modal);

        modal.querySelector("#vertexPlanCloseBtn")?.addEventListener("click", function () {
            modal.hidden = true;
        });

        modal.addEventListener("click", function (event) {
            if (event.target === modal) modal.hidden = true;
        });

        return modal;
    }

    function showPlanMessage(data) {
        const modal = ensureModal();
        const plan = String(data?.plan || entitlements?.plan || "free");
        const code = String(data?.code || data?.reason || "upgrade_required");
        const feature = String(data?.feature || "");
        const quota = data?.quota || data || {};
        const title = modal.querySelector("#vertexPlanModalTitle");
        const message = modal.querySelector("#vertexPlanModalMessage");
        const current = modal.querySelector("#vertexPlanModalCurrent");
        const icon = modal.querySelector("#vertexPlanModalIcon");
        const upgrade = modal.querySelector("#vertexPlanUpgradeLink");

        const featureNames = {
            ai_text: "رسائل Vertex AI",
            vision_image: "تحليل الصور",
            pdf: "تحليل PDF",
            image_generation: "توليد الصور",
            project_mode: "Project Mode",
            voice: "المحادثة الصوتية"
        };

        if (code === "quota_exceeded") {
            if (title) title.textContent = "وصلت للحد اليومي";
            if (icon) icon.textContent = "⏳";
            const limit = Number(quota?.limit || 0);
            if (message) {
                message.textContent = `استخدمت الحد اليومي لـ ${featureNames[feature] || "هذه الميزة"}${limit ? ` (${limit})` : ""}. يتجدد الحد تلقائيًا غدًا.`;
            }
        } else {
            if (title) title.textContent = "هذه الميزة تحتاج ترقية";
            if (icon) icon.textContent = "🔒";
            if (message) {
                message.textContent = feature === "pdf"
                    ? "رفع وتحليل ملفات PDF متاح في خطتي Pro وPlus."
                    : feature === "project_mode"
                        ? "Project Mode وأدوات المشاريع متاحة في خطتي Pro وPlus."
                        : "رقِّ خطتك للحصول على حدود أعلى ومزايا Vertex المتقدمة.";
            }
        }

        if (current) current.textContent = `خطتك الحالية: ${planLabel(plan)}`;
        if (upgrade) upgrade.hidden = plan === "plus";
        modal.hidden = false;
    }

    async function loadEntitlements(force) {
        if (!force && entitlements) return entitlements;
        if (!client) return null;

        const result = await client.rpc("vertex_get_entitlements");
        if (result.error) {
            console.warn("Vertex plan entitlements unavailable:", result.error);
            return null;
        }

        entitlements = result.data || null;
        updatePlanBadge();
        return entitlements;
    }

    function updatePlanBadge() {
        const actions = document.querySelector(".topbar-actions");
        if (!actions || !entitlements) return;

        let badge = document.getElementById("vertexPlanBadge");
        if (!badge) {
            badge = document.createElement("button");
            badge.id = "vertexPlanBadge";
            badge.type = "button";
            badge.className = "vertex-plan-badge";
            badge.title = "الخطة وحدود الاستخدام";
            badge.addEventListener("click", function () {
                window.location.href = "plans.html";
            });

            const upgrade = actions.querySelector(".upgrade-plan-btn");
            if (upgrade) actions.insertBefore(badge, upgrade);
            else actions.appendChild(badge);
        }

        badge.dataset.plan = entitlements.plan || "free";
        badge.textContent = planLabel(entitlements.plan || "free");

        const upgradeLink = actions.querySelector(".upgrade-plan-btn");
        if (upgradeLink) {
            upgradeLink.hidden = entitlements.plan === "plus";
        }
    }

    function staticFeatureAllowed(feature) {
        if (!entitlements) return true;
        const plan = String(entitlements.plan || "free");
        if (feature === "pdf" || feature === "project_mode") {
            return plan === "pro" || plan === "plus";
        }
        return true;
    }

    async function consumeVoice() {
        if (!client) return true;
        const result = await client.rpc("vertex_consume_feature", { p_feature: "voice" });
        if (result.error) {
            console.warn("Vertex voice quota check failed:", result.error);
            return true;
        }

        const quota = result.data || {};
        if (quota.allowed !== true) {
            showPlanMessage({ ...quota, code: quota.reason, feature: "voice", quota });
            return false;
        }

        await loadEntitlements(true).catch(function () {});
        return true;
    }

    function patchInvoke() {
        if (!client?.functions || invokePatched) return;
        const originalInvoke = client.functions.invoke.bind(client.functions);

        client.functions.invoke = async function (functionName, options) {
            const name = String(functionName || "");
            if (!GUARDED_FUNCTIONS.has(name)) {
                return originalInvoke(functionName, options);
            }

            const payload = options?.body && typeof options.body === "object"
                ? options.body
                : {};

            const result = await originalInvoke("vertex-plan-proxy", {
                body: {
                    target: name,
                    payload
                }
            });

            const data = result?.data || {};
            if (data?.vertex_quota) {
                await loadEntitlements(true).catch(function () {});
            }

            if (data?.code === "upgrade_required" || data?.code === "quota_exceeded") {
                showPlanMessage({
                    ...data,
                    feature: data.feature,
                    plan: data.plan,
                    quota: data.quota || {}
                });
            }

            return result;
        };

        invokePatched = true;
    }

    function installCaptureGuards() {
        document.addEventListener("click", async function (event) {
            const voiceButton = event.target?.closest?.("#vertexVoiceLaunchBtn");
            if (voiceButton && voiceButton.dataset.vertexPlanBypass !== "1") {
                event.preventDefault();
                event.stopImmediatePropagation();

                const allowed = await consumeVoice();
                if (!allowed) return;

                voiceButton.dataset.vertexPlanBypass = "1";
                voiceButton.click();
                delete voiceButton.dataset.vertexPlanBypass;
                return;
            }

            const projectsButton = event.target?.closest?.("#projectsBtn");
            if (projectsButton && projectsButton.dataset.vertexPlanBypass !== "1") {
                event.preventDefault();
                event.stopImmediatePropagation();

                await ready().catch(function () {});
                if (!staticFeatureAllowed("project_mode")) {
                    showPlanMessage({ code: "upgrade_required", feature: "project_mode", plan: entitlements?.plan || "free" });
                    return;
                }

                projectsButton.dataset.vertexPlanBypass = "1";
                projectsButton.click();
                delete projectsButton.dataset.vertexPlanBypass;
            }
        }, true);

        document.addEventListener("change", function (event) {
            const input = event.target;
            if (!input || input.id !== "vertexVisionFileInput") return;
            const file = input.files?.[0];
            if (!file) return;

            const isPdf = String(file.type || "").toLowerCase() === "application/pdf" || /\.pdf$/i.test(file.name || "");
            if (isPdf && !staticFeatureAllowed("pdf")) {
                event.preventDefault();
                event.stopImmediatePropagation();
                input.value = "";
                showPlanMessage({ code: "upgrade_required", feature: "pdf", plan: entitlements?.plan || "free" });
            }
        }, true);
    }

    async function init() {
        installStyles();
        installCaptureGuards();

        if (!window.VertexAuth || typeof window.VertexAuth.ensureSupabase !== "function") {
            return null;
        }

        try {
            await window.VertexAuth.whenReady?.();
            client = await window.VertexAuth.ensureSupabase();
            patchInvoke();
            await loadEntitlements(true);
            return entitlements;
        } catch (error) {
            console.warn("Vertex plan access init failed:", error);
            return null;
        }
    }

    function ready() {
        if (!readyPromise) readyPromise = init();
        return readyPromise;
    }

    window.VertexPlan = {
        ready,
        refresh: function () {
            return ready().then(function () {
                return loadEntitlements(true);
            });
        },
        get: function () {
            return entitlements;
        },
        canUse: function (feature) {
            return staticFeatureAllowed(feature);
        },
        showUpgrade: function (feature) {
            showPlanMessage({ code: "upgrade_required", feature, plan: entitlements?.plan || "free" });
        }
    };

    ready();
})();
