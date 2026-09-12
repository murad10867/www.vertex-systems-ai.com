// ==========================================
// Vertex AI - Image analysis / Vision
// ==========================================

(function () {
    "use strict";

    const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    const ALLOWED_TYPES = new Set([
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/heic",
        "image/heif"
    ]);

    let selectedImage = null;
    let originalGenerateAIReply = null;

    function installStyles() {
        if (document.getElementById("vertexVisionStyles")) return;

        const style = document.createElement("style");
        style.id = "vertexVisionStyles";
        style.textContent = `
            .vertex-vision-button {
                width: 34px;
                height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(255,255,255,.09);
                border-radius: 9px;
                background: rgba(255,255,255,.035);
                color: #d9ecff;
                cursor: pointer;
                font-size: 16px;
                transition: .18s ease;
            }

            .vertex-vision-button:hover {
                border-color: rgba(69,199,255,.42);
                background: rgba(69,199,255,.10);
                transform: translateY(-1px);
            }

            .vertex-vision-button.has-image {
                border-color: rgba(69,199,255,.58);
                background: rgba(34,151,231,.15);
                box-shadow: 0 0 0 3px rgba(34,151,231,.06);
            }

            .vertex-vision-preview {
                display: none;
                align-items: center;
                gap: 10px;
                margin: 0 0 8px;
                padding: 8px;
                border: 1px solid rgba(69,199,255,.20);
                border-radius: 11px;
                background: rgba(5,15,27,.72);
                direction: rtl;
            }

            .vertex-vision-preview.visible {
                display: flex;
            }

            .vertex-vision-thumb {
                width: 58px;
                height: 58px;
                flex: 0 0 58px;
                border-radius: 9px;
                object-fit: cover;
                background: #09111c;
                border: 1px solid rgba(255,255,255,.08);
            }

            .vertex-vision-info {
                min-width: 0;
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .vertex-vision-info strong {
                color: #edf8ff;
                font-size: 11px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .vertex-vision-info span {
                color: #7f91a8;
                font-size: 10px;
            }

            .vertex-vision-remove {
                width: 30px;
                height: 30px;
                flex: 0 0 30px;
                border: 1px solid rgba(255,255,255,.08);
                border-radius: 8px;
                background: rgba(255,255,255,.04);
                color: #c9d7e7;
                cursor: pointer;
            }

            .vertex-vision-remove:hover {
                color: #fff;
                background: rgba(244,63,94,.12);
                border-color: rgba(244,63,94,.28);
            }

            .composer-wrapper.vertex-vision-drag {
                outline: 2px dashed rgba(69,199,255,.55);
                outline-offset: 3px;
            }
        `;
        document.head.appendChild(style);
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "";
        if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function showImageError(message) {
        const status = document.getElementById("topConversationStatus");
        const previous = status ? status.textContent : "";

        if (status) {
            status.textContent = message;
            status.style.color = "#ff9cae";
            setTimeout(function () {
                status.textContent = previous || "Vertex AI جاهز";
                status.style.color = "";
            }, 3200);
        } else {
            window.alert(message);
        }
    }

    function readFileAsDataURL(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = function () {
                reject(reader.error || new Error("file_read_failed"));
            };
            reader.readAsDataURL(file);
        });
    }

    async function selectImage(file) {
        if (!file) return;

        const type = String(file.type || "").toLowerCase();
        if (!ALLOWED_TYPES.has(type)) {
            showImageError("صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو GIF.");
            return;
        }

        if (file.size > MAX_IMAGE_BYTES) {
            showImageError("الصورة كبيرة جدًا. الحد الأقصى 8MB.");
            return;
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            const commaIndex = dataUrl.indexOf(",");
            const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";

            if (!base64) throw new Error("empty_image_data");

            selectedImage = {
                name: file.name || "image",
                size: file.size || 0,
                mimeType: type,
                base64,
                dataUrl
            };

            renderPreview();
        } catch (error) {
            console.error("Vertex vision file error:", error);
            showImageError("تعذر قراءة الصورة. اختر صورة أخرى.");
        }
    }

    function clearSelectedImage() {
        selectedImage = null;

        const fileInput = document.getElementById("vertexVisionFileInput");
        if (fileInput) fileInput.value = "";

        renderPreview();
    }

    function renderPreview() {
        const preview = document.getElementById("vertexVisionPreview");
        const thumb = document.getElementById("vertexVisionThumb");
        const name = document.getElementById("vertexVisionName");
        const meta = document.getElementById("vertexVisionMeta");
        const button = document.getElementById("vertexVisionButton");

        if (!preview || !thumb || !name || !meta || !button) return;

        if (!selectedImage) {
            preview.classList.remove("visible");
            button.classList.remove("has-image");
            thumb.removeAttribute("src");
            name.textContent = "";
            meta.textContent = "";
            return;
        }

        preview.classList.add("visible");
        button.classList.add("has-image");
        thumb.src = selectedImage.dataUrl;
        name.textContent = selectedImage.name;
        meta.textContent = "جاهزة للتحليل • " + formatBytes(selectedImage.size);
    }

    function buildUI() {
        if (document.getElementById("vertexVisionButton")) return;

        const wrapper = document.querySelector(".composer-wrapper");
        const tools = document.querySelector(".composer-tools");
        const clearButton = document.getElementById("clearInputBtn");

        if (!wrapper || !tools) return;

        const fileInput = document.createElement("input");
        fileInput.id = "vertexVisionFileInput";
        fileInput.type = "file";
        fileInput.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif";
        fileInput.hidden = true;
        document.body.appendChild(fileInput);

        const button = document.createElement("button");
        button.id = "vertexVisionButton";
        button.type = "button";
        button.className = "vertex-vision-button";
        button.title = "إرفاق صورة لتحليلها";
        button.setAttribute("aria-label", "إرفاق صورة لتحليلها");
        button.textContent = "🖼️";

        if (clearButton) {
            tools.insertBefore(button, clearButton);
        } else {
            tools.prepend(button);
        }

        const preview = document.createElement("div");
        preview.id = "vertexVisionPreview";
        preview.className = "vertex-vision-preview";
        preview.innerHTML = `
            <img id="vertexVisionThumb" class="vertex-vision-thumb" alt="معاينة الصورة المرفقة">
            <div class="vertex-vision-info">
                <strong id="vertexVisionName"></strong>
                <span id="vertexVisionMeta"></span>
            </div>
            <button id="vertexVisionRemove" type="button" class="vertex-vision-remove" title="حذف الصورة">✕</button>
        `;
        wrapper.insertBefore(preview, wrapper.firstChild);

        button.addEventListener("click", function () {
            fileInput.click();
        });

        fileInput.addEventListener("change", function () {
            selectImage(fileInput.files && fileInput.files[0]);
        });

        preview.querySelector("#vertexVisionRemove")?.addEventListener("click", clearSelectedImage);

        wrapper.addEventListener("dragover", function (event) {
            if (!event.dataTransfer) return;
            if (Array.from(event.dataTransfer.types || []).includes("Files")) {
                event.preventDefault();
                wrapper.classList.add("vertex-vision-drag");
            }
        });

        wrapper.addEventListener("dragleave", function () {
            wrapper.classList.remove("vertex-vision-drag");
        });

        wrapper.addEventListener("drop", function (event) {
            wrapper.classList.remove("vertex-vision-drag");
            const file = event.dataTransfer?.files?.[0];
            if (file && String(file.type || "").startsWith("image/")) {
                event.preventDefault();
                selectImage(file);
            }
        });

        const messageInput = document.getElementById("messageInput");
        messageInput?.addEventListener("paste", function (event) {
            const items = Array.from(event.clipboardData?.items || []);
            const imageItem = items.find(function (item) {
                return String(item.type || "").startsWith("image/");
            });

            if (!imageItem) return;
            const file = imageItem.getAsFile();
            if (file) {
                event.preventDefault();
                selectImage(file);
            }
        });

        renderPreview();
    }

    async function getSupabaseClient() {
        if (
            window.VertexAuth &&
            typeof window.VertexAuth.ensureSupabase === "function"
        ) {
            return await window.VertexAuth.ensureSupabase();
        }

        if (
            typeof window.supabaseClient !== "undefined" &&
            window.supabaseClient &&
            window.supabaseClient.functions
        ) {
            return window.supabaseClient;
        }

        if (
            typeof supabaseClient !== "undefined" &&
            supabaseClient &&
            supabaseClient.functions
        ) {
            return supabaseClient;
        }

        throw new Error("supabase_not_ready");
    }

    function getConversationPayload(userText) {
        try {
            if (typeof getActiveConversation === "function") {
                const conversation = getActiveConversation();
                if (conversation && Array.isArray(conversation.messages)) {
                    return conversation.messages.slice(-8).map(function (message) {
                        return {
                            role: message.role,
                            content: String(message.content || "")
                        };
                    });
                }
            }
        } catch (error) {
            console.warn("Vertex vision history unavailable:", error);
        }

        return [{ role: "user", content: userText }];
    }

    function getMemoryPayload() {
        try {
            if (
                typeof settings !== "undefined" &&
                settings &&
                settings.memoryEnabled &&
                typeof memories !== "undefined" &&
                Array.isArray(memories)
            ) {
                return memories.slice(0, 12).map(function (memory) {
                    return { content: String(memory.content || "") };
                });
            }
        } catch (error) {
            console.warn("Vertex vision memories unavailable:", error);
        }

        return [];
    }

    function getAssistantName() {
        try {
            if (
                typeof settings !== "undefined" &&
                settings &&
                typeof settings.assistantName === "string" &&
                settings.assistantName.trim()
            ) {
                return settings.assistantName.trim();
            }
        } catch (_) {}

        return "Vertex AI";
    }

    async function analyzeImage(userText) {
        if (!selectedImage) {
            if (originalGenerateAIReply) {
                return await originalGenerateAIReply(userText);
            }
            throw new Error("vision_no_image");
        }

        const imageForRequest = {
            mimeType: selectedImage.mimeType,
            base64: selectedImage.base64
        };

        const client = await getSupabaseClient();
        const result = await client.functions.invoke("vertex-ai-vision", {
            body: {
                prompt: userText,
                messages: getConversationPayload(userText),
                memories: getMemoryPayload(),
                assistantName: getAssistantName(),
                image: imageForRequest
            }
        });

        if (result.error) {
            throw result.error;
        }

        const data = result.data || {};
        if (typeof data.reply !== "string" || !data.reply.trim()) {
            throw new Error(data.error || "empty_vision_reply");
        }

        clearSelectedImage();

        try {
            if (typeof applyResponseStyle === "function") {
                return applyResponseStyle(data.reply.trim());
            }
        } catch (_) {}

        return data.reply.trim();
    }

    function installVisionOverride() {
        if (window.__vertexVisionInstalled) return;

        originalGenerateAIReply =
            typeof window.generateAIReply === "function"
                ? window.generateAIReply
                : null;

        if (!originalGenerateAIReply) {
            console.warn("Vertex vision: generateAIReply was not found.");
            return;
        }

        window.generateAIReply = async function (userText) {
            if (!selectedImage) {
                return await originalGenerateAIReply(userText);
            }

            return await analyzeImage(userText);
        };

        window.__vertexVisionInstalled = true;
    }

    function ensurePromptForImage() {
        if (!selectedImage) return;

        const input = document.getElementById("messageInput");
        if (!input || input.value.trim()) return;

        input.value = "حلّل هذه الصورة واشرح أهم ما يظهر فيها.";
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function installSendHelpers() {
        const sendButton = document.getElementById("sendBtn");
        const input = document.getElementById("messageInput");

        sendButton?.addEventListener("click", function () {
            ensurePromptForImage();
        }, true);

        input?.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                ensurePromptForImage();
            }
        }, true);
    }

    function start() {
        installStyles();
        buildUI();
        installVisionOverride();
        installSendHelpers();

        window.VertexVision = {
            hasImage: function () {
                return Boolean(selectedImage);
            },
            clear: clearSelectedImage
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
