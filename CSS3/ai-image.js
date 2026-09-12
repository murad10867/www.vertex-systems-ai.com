// ==========================================
// Vertex AI image generation
// Cloudflare Workers AI via Supabase
// ==========================================

(function () {
    "use strict";

    const DB_NAME = "vertex-ai-media";
    const STORE_NAME = "images";
    const IMAGE_MARKER = /\[\[VERTEX_IMAGE:([a-zA-Z0-9_-]+)\]\]/g;

    let imageGenerationBusy = false;
    let imageCreateMode = false;
    let normalPlaceholder = "";

    function isImageRequest(text) {
        const value = String(text || "").trim().toLowerCase();
        const arabic = /(?:انشئ|أنشئ|اصنع|سوي|سوِ|سوّي|ارسم|ولد|ولّد|صمم|صمّم).{0,25}(?:صورة|صوره|صور|رسمة|رسمه)/u;
        const arabicReverse = /(?:صورة|صوره|صور|رسمة|رسمه).{0,25}(?:انشئ|أنشئ|اصنع|سوي|ارسم|ولد|ولّد|صمم|صمّم)/u;
        const english = /(?:create|generate|make|draw|design).{0,24}(?:image|picture|photo|illustration)/i;
        return arabic.test(value) || arabicReverse.test(value) || english.test(value);
    }

    function makeId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function openDatabase() {
        return new Promise(function (resolve, reject) {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = function () {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }

    async function saveImage(id, dataUrl) {
        const db = await openDatabase();
        await new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(dataUrl, id);
            tx.oncomplete = resolve;
            tx.onerror = function () { reject(tx.error); };
        });
        db.close();
    }

    async function loadImage(id) {
        const db = await openDatabase();
        const result = await new Promise(function (resolve, reject) {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(id);
            request.onsuccess = function () { resolve(request.result || null); };
            request.onerror = function () { reject(request.error); };
        });
        db.close();
        return result;
    }

    function installStyles() {
        if (document.getElementById("vertexImageStyles")) return;

        const style = document.createElement("style");
        style.id = "vertexImageStyles";
        style.textContent = `
            .vertex-image-card {
                margin-top: 12px;
                width: min(100%, 620px);
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.09);
                border-radius: 15px;
                background: #0b1018;
            }

            .vertex-image-card img {
                display: block;
                width: 100%;
                height: auto;
                max-height: 650px;
                object-fit: contain;
                background: #070a0f;
            }

            .vertex-image-toolbar {
                padding: 9px 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                direction: rtl;
            }

            .vertex-image-toolbar span {
                color: #8594aa;
                font-size: 10px;
            }

            .vertex-image-download {
                padding: 7px 10px;
                border: 1px solid rgba(255,255,255,0.09);
                border-radius: 8px;
                background: #172130;
                color: #d9ecff;
                cursor: pointer;
                font-size: 10px;
            }

            .vertex-image-generating { opacity: .85; }

            #vertexVisionButton.vertex-image-create-launch {
                width: auto !important;
                min-width: 92px !important;
                height: 34px !important;
                padding: 0 11px !important;
                gap: 6px;
                white-space: nowrap;
                font-size: 11px !important;
                font-weight: 800;
                border-color: rgba(96,165,250,.30);
                background: linear-gradient(135deg, rgba(37,99,235,.18), rgba(14,165,233,.10));
                color: #e3f4ff;
            }

            #vertexVisionButton.vertex-image-create-launch:hover {
                border-color: rgba(96,165,250,.55);
                background: linear-gradient(135deg, rgba(37,99,235,.30), rgba(14,165,233,.17));
            }

            #vertexVisionButton.vertex-image-create-launch.vertex-image-mode {
                border-color: rgba(167,139,250,.60);
                background: linear-gradient(135deg, rgba(124,58,237,.28), rgba(37,99,235,.22));
                box-shadow: 0 0 0 3px rgba(124,58,237,.08);
            }

            .vertex-attachment-launch {
                width: 34px;
                height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(255,255,255,.09);
                border-radius: 9px;
                background: rgba(255,255,255,.035);
                color: #c8d9eb;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                transition: .18s ease;
            }

            .vertex-attachment-launch:hover {
                border-color: rgba(69,199,255,.38);
                background: rgba(69,199,255,.09);
                color: #fff;
            }

            @media (max-width: 520px) {
                #vertexVisionButton.vertex-image-create-launch {
                    min-width: 82px !important;
                    padding: 0 8px !important;
                    font-size: 10px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function cleanMarkerFromText(element, id) {
        if (!element) return;
        const marker = "[[VERTEX_IMAGE:" + id + "]]";
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (node) {
            if (node.nodeValue && node.nodeValue.includes(marker)) {
                node.nodeValue = node.nodeValue.replace(marker, "").replace(/\n{3,}/g, "\n\n");
            }
        });
    }

    function downloadDataUrl(dataUrl, filename) {
        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = filename || "vertex-image.jpg";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    async function renderStoredImage(messageElement, id) {
        if (!messageElement || messageElement.dataset.vertexImageRendered === id) return;

        const messageText = messageElement.querySelector(".message-text");
        cleanMarkerFromText(messageText, id);

        const dataUrl = await loadImage(id).catch(function () { return null; });
        if (!dataUrl || !messageElement.isConnected) return;

        messageElement.dataset.vertexImageRendered = id;
        const messageContent = messageElement.querySelector(".message-content");
        if (!messageContent) return;

        const card = document.createElement("div");
        card.className = "vertex-image-card";

        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "صورة أنشأها Vertex AI";
        img.loading = "lazy";

        const toolbar = document.createElement("div");
        toolbar.className = "vertex-image-toolbar";

        const label = document.createElement("span");
        label.textContent = "Vertex AI • FLUX";

        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "vertex-image-download";
        downloadButton.textContent = "⬇️ تحميل الصورة";
        downloadButton.addEventListener("click", function () {
            downloadDataUrl(dataUrl, "vertex-image-" + id + ".jpg");
        });

        toolbar.appendChild(label);
        toolbar.appendChild(downloadButton);
        card.appendChild(img);
        card.appendChild(toolbar);

        const actions = messageContent.querySelector(".message-actions");
        if (actions) messageContent.insertBefore(card, actions);
        else messageContent.appendChild(card);
    }

    function scanForImages(root) {
        const scope = root && root.querySelectorAll ? root : document;
        const messages = [];

        if (root && root.nodeType === Node.ELEMENT_NODE && root.matches && root.matches(".message.assistant")) {
            messages.push(root);
        }

        scope.querySelectorAll(".message.assistant").forEach(function (message) {
            messages.push(message);
        });

        messages.forEach(function (message) {
            const text = message.querySelector(".message-text");
            if (!text) return;

            const source = text.textContent || "";
            const regex = new RegExp(IMAGE_MARKER.source, "g");
            let match;
            while ((match = regex.exec(source)) !== null) {
                renderStoredImage(message, match[1]);
            }
        });
    }

    async function getSupabaseClient() {
        if (window.VertexAuth && typeof window.VertexAuth.ensureSupabase === "function") {
            return await window.VertexAuth.ensureSupabase();
        }

        if (typeof window.supabaseClient !== "undefined" && window.supabaseClient?.functions) {
            return window.supabaseClient;
        }

        throw new Error("supabase_not_ready");
    }

    function addAssistantText(text) {
        if (typeof window.addMessage === "function") window.addMessage("assistant", text);
        if (typeof window.renderChat === "function") window.renderChat();
    }

    function addUserText(text) {
        if (typeof window.addMessage === "function") window.addMessage("user", text);
        if (typeof window.renderChat === "function") window.renderChat();
    }

    function showGeneratingIndicator() {
        const container = document.getElementById("messagesContainer");
        if (!container) return null;

        const element = document.createElement("article");
        element.className = "message assistant vertex-image-generating";
        element.innerHTML = `
            <div class="message-avatar">V</div>
            <div class="message-content">
                <div class="message-header">
                    <strong>Vertex AI</strong>
                    <span>ينشئ صورة...</span>
                </div>
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        `;
        container.appendChild(element);

        const chat = document.getElementById("chatView");
        if (chat) chat.scrollTop = chat.scrollHeight;
        return element;
    }

    function setImageMode(enabled) {
        imageCreateMode = Boolean(enabled);

        const input = document.getElementById("messageInput");
        const button = document.getElementById("vertexVisionButton");

        if (input && !normalPlaceholder) {
            normalPlaceholder = input.getAttribute("placeholder") || "اكتب رسالتك إلى Vertex AI...";
        }

        if (button) {
            button.classList.toggle("vertex-image-mode", imageCreateMode);
            button.innerHTML = imageCreateMode ? "✓ إنشاء صورة" : "إنشاء صورة";
            button.title = imageCreateMode
                ? "وضع إنشاء الصور مفعّل — اكتب وصف الصورة ثم أرسل"
                : "إنشاء صورة بالذكاء الاصطناعي";
            button.setAttribute("aria-label", button.title);
        }

        if (input) {
            input.placeholder = imageCreateMode
                ? "صف الصورة التي تريد إنشاءها..."
                : (normalPlaceholder || "اكتب رسالتك إلى Vertex AI...");
        }
    }

    function installComposerControls() {
        const createButton = document.getElementById("vertexVisionButton");
        const tools = document.querySelector(".composer-tools");
        const fileInput = document.getElementById("vertexVisionFileInput");

        if (!createButton || !tools || !fileInput) {
            setTimeout(installComposerControls, 120);
            return;
        }

        if (!createButton.classList.contains("vertex-image-create-launch")) {
            createButton.classList.add("vertex-image-create-launch");
            createButton.innerHTML = "إنشاء صورة";
            createButton.title = "إنشاء صورة بالذكاء الاصطناعي";
            createButton.setAttribute("aria-label", "إنشاء صورة بالذكاء الاصطناعي");

            // ai-vision originally used this button for file upload. Capture the click
            // first so the same control now becomes Create Image instead of the paperclip.
            createButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopImmediatePropagation();

                const input = document.getElementById("messageInput");
                const text = String(input?.value || "").trim();

                if (!imageCreateMode && text) {
                    setImageMode(true);
                    generateImageFromPrompt(text);
                    return;
                }

                setImageMode(!imageCreateMode);
                if (input) input.focus();
            }, true);
        }

        if (!document.getElementById("vertexAttachmentLaunchBtn")) {
            const uploadButton = document.createElement("button");
            uploadButton.id = "vertexAttachmentLaunchBtn";
            uploadButton.type = "button";
            uploadButton.className = "vertex-attachment-launch";
            uploadButton.title = "رفع صورة أو PDF";
            uploadButton.setAttribute("aria-label", "رفع صورة أو ملف PDF");
            uploadButton.textContent = "+";
            uploadButton.addEventListener("click", function () {
                setImageMode(false);
                fileInput.click();
            });

            createButton.insertAdjacentElement("afterend", uploadButton);
        }
    }

    async function generateImageFromPrompt(text) {
        if (imageGenerationBusy) return;

        const prompt = String(text || "").trim();
        if (!prompt) {
            setImageMode(true);
            document.getElementById("messageInput")?.focus();
            return;
        }

        imageGenerationBusy = true;
        const input = document.getElementById("messageInput");
        const sendButton = document.getElementById("sendBtn");

        if (input) {
            input.value = "";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }

        if (sendButton) sendButton.disabled = true;

        addUserText(prompt);
        const indicator = showGeneratingIndicator();

        try {
            const client = await getSupabaseClient();
            const result = await client.functions.invoke("vertex-image", {
                body: { prompt }
            });

            if (result.error) throw result.error;

            const data = result.data || {};
            if (typeof data.image_data_url !== "string" || !data.image_data_url.startsWith("data:image/")) {
                if (data.code === "missing_cloudflare_credentials") {
                    throw new Error("missing_cloudflare_credentials");
                }
                throw new Error(data.code || "empty_image");
            }

            const id = makeId();
            await saveImage(id, data.image_data_url);

            if (indicator) indicator.remove();
            addAssistantText("🖼️ تم إنشاء الصورة.\n[[VERTEX_IMAGE:" + id + "]]");
            setTimeout(function () { scanForImages(document); }, 100);
        }
        catch (error) {
            console.error("Vertex image generation failed:", error);
            if (indicator) indicator.remove();

            const message = String(error?.message || error || "").toLowerCase();
            if (message.includes("missing_cloudflare_credentials")) {
                addAssistantText("⚙️ توليد الصور جاهز في Vertex AI، لكن بيانات Cloudflare لم تُضف إلى Supabase بعد.");
            }
            else if (message.includes("429") || message.includes("limit")) {
                addAssistantText("⏳ وصلت خدمة الصور إلى حد الاستخدام الحالي. جرّب لاحقًا أو راجع حدود خطتك.");
            }
            else {
                addAssistantText("⚠️ تعذر إنشاء الصورة الآن. حاول مرة أخرى بعد قليل.");
            }
        }
        finally {
            imageGenerationBusy = false;
            setImageMode(false);
            if (sendButton) sendButton.disabled = false;
            if (input) input.focus();
        }
    }

    function interceptImageSend(event) {
        const input = document.getElementById("messageInput");
        if (!input) return;

        const text = input.value.trim();
        if (!text || (!imageCreateMode && !isImageRequest(text))) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        generateImageFromPrompt(text);
    }

    function start() {
        installStyles();
        installComposerControls();

        const sendButton = document.getElementById("sendBtn");
        const input = document.getElementById("messageInput");

        if (sendButton) {
            sendButton.addEventListener("click", interceptImageSend, true);
        }

        if (input) {
            normalPlaceholder = input.getAttribute("placeholder") || "اكتب رسالتك إلى Vertex AI...";
            input.addEventListener("keydown", function (event) {
                if (event.key === "Enter" && !event.shiftKey) {
                    interceptImageSend(event);
                }
            }, true);
        }

        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === Node.ELEMENT_NODE) scanForImages(node);
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        scanForImages(document);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    }
    else {
        start();
    }
})();
