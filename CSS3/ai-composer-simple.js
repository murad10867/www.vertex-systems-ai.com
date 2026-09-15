// Vertex AI composer: one + button and one microphone button.
(function () {
    "use strict";

    if (window.__vertexSimpleComposerInstalled) return;
    window.__vertexSimpleComposerInstalled = true;

    function installStyles() {
        if (document.getElementById("vertexSimpleComposerStyles")) return;

        const style = document.createElement("style");
        style.id = "vertexSimpleComposerStyles";
        style.textContent = `
            #vertexVisionButton,
            #vertexAttachmentLaunchBtn,
            #vertexCreateImageBtn,
            #vertexAttachmentButton,
            #clearInputBtn {
                display: none !important;
            }

            .vertex-simple-plus {
                width: 42px;
                height: 42px;
                flex: 0 0 42px;
                border-radius: 14px;
                border: 1px solid rgba(69,199,255,.38);
                background: rgba(20,124,244,.10);
                color: #eef8ff;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 29px;
                font-weight: 300;
                line-height: 1;
                transition: .18s ease;
            }

            .vertex-simple-plus:hover,
            .vertex-simple-plus.menu-open {
                transform: translateY(-1px);
                border-color: rgba(69,199,255,.68);
                background: rgba(20,124,244,.18);
            }

            .vertex-plus-menu {
                position: fixed;
                z-index: 210000;
                min-width: 205px;
                padding: 7px;
                border: 1px solid rgba(255,255,255,.10);
                border-radius: 15px;
                background: rgba(8,17,31,.98);
                box-shadow: 0 18px 55px rgba(0,0,0,.45);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                direction: rtl;
            }

            .vertex-plus-menu[hidden] {
                display: none !important;
            }

            .vertex-plus-menu button {
                width: 100%;
                min-height: 43px;
                padding: 0 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                border: 0;
                border-radius: 10px;
                background: transparent;
                color: #e8f4ff;
                cursor: pointer;
                text-align: right;
                font: inherit;
                font-size: 12px;
                font-weight: 700;
            }

            .vertex-plus-menu button:hover {
                background: rgba(69,199,255,.10);
            }

            .vertex-plus-menu .vertex-plus-icon {
                width: 25px;
                text-align: center;
                font-size: 17px;
            }

            @media (max-width: 520px) {
                .vertex-simple-plus,
                #vertexVoiceLaunchBtn.vertex-voice-launch {
                    width: 42px;
                    height: 42px;
                    flex-basis: 42px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function closeMenu() {
        const menu = document.getElementById("vertexSimplePlusMenu");
        const plus = document.getElementById("vertexSimplePlusBtn");
        if (menu) menu.hidden = true;
        if (plus) plus.classList.remove("menu-open");
    }

    function positionMenu() {
        const menu = document.getElementById("vertexSimplePlusMenu");
        const plus = document.getElementById("vertexSimplePlusBtn");
        if (!menu || !plus || menu.hidden) return;

        const rect = plus.getBoundingClientRect();
        const menuWidth = Math.max(menu.offsetWidth || 205, 205);
        const menuHeight = menu.offsetHeight || 100;
        const gap = 9;

        let left = rect.left;
        if (left + menuWidth > window.innerWidth - 10) {
            left = window.innerWidth - menuWidth - 10;
        }
        left = Math.max(10, left);

        let top = rect.top - menuHeight - gap;
        if (top < 10) top = rect.bottom + gap;

        menu.style.left = left + "px";
        menu.style.top = top + "px";
    }

    function openMenu() {
        const menu = document.getElementById("vertexSimplePlusMenu");
        const plus = document.getElementById("vertexSimplePlusBtn");
        if (!menu || !plus) return;

        menu.hidden = false;
        plus.classList.add("menu-open");
        requestAnimationFrame(positionMenu);
    }

    function buildMenu() {
        let menu = document.getElementById("vertexSimplePlusMenu");
        if (menu) return menu;

        menu = document.createElement("div");
        menu.id = "vertexSimplePlusMenu";
        menu.className = "vertex-plus-menu";
        menu.hidden = true;
        menu.innerHTML = `
            <button id="vertexSimpleCreateImage" type="button">
                <span class="vertex-plus-icon">🎨</span>
                <span>إنشاء صورة</span>
            </button>
            <button id="vertexSimpleUploadFile" type="button">
                <span class="vertex-plus-icon">📎</span>
                <span>رفع صورة أو PDF</span>
            </button>
        `;
        document.body.appendChild(menu);

        menu.querySelector("#vertexSimpleCreateImage")?.addEventListener("click", function () {
            closeMenu();
            const hiddenCreate = document.getElementById("vertexVisionButton");
            if (hiddenCreate) hiddenCreate.click();
            else document.getElementById("messageInput")?.focus();
        });

        menu.querySelector("#vertexSimpleUploadFile")?.addEventListener("click", function () {
            closeMenu();
            const hiddenUpload = document.getElementById("vertexAttachmentLaunchBtn");
            if (hiddenUpload) {
                hiddenUpload.click();
                return;
            }
            document.getElementById("vertexVisionFileInput")?.click();
        });

        return menu;
    }

    function installControls(attempt) {
        const tools = document.querySelector(".composer-tools");
        const mic = document.getElementById("vertexVoiceLaunchBtn");
        const create = document.getElementById("vertexVisionButton");
        const upload = document.getElementById("vertexAttachmentLaunchBtn");

        if (!tools || !mic || !create || !upload) {
            if ((attempt || 0) < 30) {
                setTimeout(function () { installControls((attempt || 0) + 1); }, 120);
            }
            return;
        }

        let plus = document.getElementById("vertexSimplePlusBtn");
        if (!plus) {
            plus = document.createElement("button");
            plus.id = "vertexSimplePlusBtn";
            plus.type = "button";
            plus.className = "vertex-simple-plus";
            plus.title = "إضافة";
            plus.setAttribute("aria-label", "فتح خيارات الإضافة");
            plus.textContent = "+";

            plus.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                const menu = buildMenu();
                if (menu.hidden) openMenu();
                else closeMenu();
            });
        }

        // Keep only the single + control next to the microphone.
        if (mic.parentElement === tools) {
            tools.insertBefore(plus, mic.nextSibling);
        } else {
            tools.prepend(plus);
        }

        buildMenu();
    }

    function start() {
        installStyles();
        installControls(0);

        document.addEventListener("click", function (event) {
            const menu = document.getElementById("vertexSimplePlusMenu");
            const plus = document.getElementById("vertexSimplePlusBtn");
            if (!menu || menu.hidden) return;
            if (menu.contains(event.target) || plus?.contains(event.target)) return;
            closeMenu();
        });

        window.addEventListener("resize", function () {
            positionMenu();
        });

        window.addEventListener("scroll", function () {
            positionMenu();
        }, true);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
