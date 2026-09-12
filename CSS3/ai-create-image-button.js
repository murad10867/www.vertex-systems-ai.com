// Vertex AI composer shortcuts: create image + keep attachment upload.
(function () {
    "use strict";

    function installStyles() {
        if (document.getElementById("vertexCreateImageButtonStyles")) return;

        const style = document.createElement("style");
        style.id = "vertexCreateImageButtonStyles";
        style.textContent = `
            #vertexVisionButton {
                display: none !important;
            }

            .vertex-create-image-button,
            .vertex-attachment-button {
                height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(255,255,255,.09);
                border-radius: 9px;
                background: rgba(255,255,255,.035);
                color: #d9ecff;
                cursor: pointer;
                transition: .18s ease;
            }

            .vertex-create-image-button {
                width: auto;
                min-width: 92px;
                padding: 0 11px;
                gap: 6px;
                font-size: 11px;
                font-weight: 800;
                white-space: nowrap;
            }

            .vertex-create-image-button:hover {
                border-color: rgba(69,199,255,.48);
                background: rgba(69,199,255,.12);
                transform: translateY(-1px);
            }

            .vertex-attachment-button {
                width: 34px;
                min-width: 34px;
                padding: 0;
                font-size: 17px;
            }

            .vertex-attachment-button:hover {
                border-color: rgba(148,163,184,.35);
                background: rgba(148,163,184,.10);
            }

            @media (max-width: 520px) {
                .vertex-create-image-button {
                    min-width: 82px;
                    padding: 0 9px;
                    font-size: 10px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function prepareImagePrompt() {
        const input = document.getElementById("messageInput");
        if (!input) return;

        const current = String(input.value || "").trim();
        const alreadyImageRequest = /(?:انشئ|أنشئ|اصنع|سوي|سوّي|ارسم|ولد|ولّد|صمم|صمّم).{0,30}(?:صورة|صوره|صور|رسمة|رسمه)/u.test(current);

        if (!current) {
            input.value = "أنشئ صورة: ";
        }
        else if (!alreadyImageRequest) {
            input.value = "أنشئ صورة: " + current;
        }

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();

        try {
            input.setSelectionRange(input.value.length, input.value.length);
        } catch (_) {}
    }

    function installButtons() {
        const originalAttachment = document.getElementById("vertexVisionButton");
        const fileInput = document.getElementById("vertexVisionFileInput");
        const tools = document.querySelector(".composer-tools");

        if (!originalAttachment || !fileInput || !tools) {
            return false;
        }

        originalAttachment.hidden = true;
        originalAttachment.setAttribute("aria-hidden", "true");
        originalAttachment.tabIndex = -1;

        if (!document.getElementById("vertexCreateImageBtn")) {
            const createButton = document.createElement("button");
            createButton.id = "vertexCreateImageBtn";
            createButton.type = "button";
            createButton.className = "vertex-create-image-button";
            createButton.title = "إنشاء صورة بالذكاء الاصطناعي";
            createButton.setAttribute("aria-label", "إنشاء صورة");
            createButton.innerHTML = "<span>🎨</span><span>إنشاء صورة</span>";
            createButton.addEventListener("click", prepareImagePrompt);
            tools.insertBefore(createButton, originalAttachment);
        }

        if (!document.getElementById("vertexAttachmentButton")) {
            const uploadButton = document.createElement("button");
            uploadButton.id = "vertexAttachmentButton";
            uploadButton.type = "button";
            uploadButton.className = "vertex-attachment-button";
            uploadButton.title = "إرفاق صورة أو PDF";
            uploadButton.setAttribute("aria-label", "إرفاق صورة أو PDF");
            uploadButton.textContent = "＋";
            uploadButton.addEventListener("click", function () {
                fileInput.click();
            });
            tools.insertBefore(uploadButton, document.getElementById("vertexCreateImageBtn"));
        }

        return true;
    }

    function start() {
        installStyles();

        if (installButtons()) return;

        let attempts = 0;
        const timer = setInterval(function () {
            attempts += 1;
            if (installButtons() || attempts >= 40) {
                clearInterval(timer);
            }
        }, 125);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    }
    else {
        start();
    }
})();
