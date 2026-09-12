// ==========================================
// Vertex AI - Images, OCR, homework and PDF analysis
// ==========================================

(function () {
    "use strict";

    const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    const MAX_PDF_BYTES = 10 * 1024 * 1024;
    const DB_NAME = "vertex-ai-attachments";
    const STORE_NAME = "files";

    const ALLOWED_TYPES = new Set([
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/heic",
        "image/heif",
        "application/pdf"
    ]);

    let selectedAttachment = null;
    let originalGenerateAIReply = null;

    function makeId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

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

            .vertex-vision-button.has-file {
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

            .vertex-vision-thumb-wrap {
                width: 58px;
                height: 58px;
                flex: 0 0 58px;
                border-radius: 9px;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #09111c;
                border: 1px solid rgba(255,255,255,.08);
            }

            .vertex-vision-thumb {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .vertex-vision-pdf-icon {
                font-size: 28px;
                line-height: 1;
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

            .vertex-chat-attachment {
                width: min(100%, 520px);
                margin: 10px 0 4px;
                border: 1px solid rgba(69,199,255,.17);
                border-radius: 12px;
                overflow: hidden;
                background: rgba(5,15,27,.68);
            }

            .vertex-chat-attachment img {
                display: block;
                width: 100%;
                max-height: 430px;
                object-fit: contain;
                background: #070c13;
            }

            .vertex-chat-file-row {
                min-height: 62px;
                padding: 10px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                direction: rtl;
            }

            .vertex-chat-file-icon {
                width: 42px;
                height: 42px;
                flex: 0 0 42px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 9px;
                background: rgba(255,255,255,.05);
                font-size: 23px;
            }

            .vertex-chat-file-meta {
                min-width: 0;
                flex: 1;
            }

            .vertex-chat-file-meta strong,
            .vertex-chat-file-meta small {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .vertex-chat-file-meta strong {
                color: #e8f6ff;
                font-size: 11px;
            }

            .vertex-chat-file-meta small {
                margin-top: 3px;
                color: #74879e;
                font-size: 9px;
            }

            .vertex-chat-attachment-actions {
                padding: 8px 10px;
                border-top: 1px solid rgba(255,255,255,.06);
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }

            .vertex-chat-attachment-actions button {
                padding: 6px 9px;
                border: 1px solid rgba(255,255,255,.08);
                border-radius: 8px;
                background: rgba(255,255,255,.04);
                color: #cfe7f7;
                cursor: pointer;
                font-size: 9px;
            }
        `;
        document.head.appendChild(style);
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return "";
        if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function showFileError(message) {
        const status = document.getElementById("topConversationStatus");
        const previous = status ? status.textContent : "";

        if (status) {
            status.textContent = message;
            status.style.color = "#ff9cae";
            setTimeout(function () {
                status.textContent = previous || "Vertex AI جاهز";
                status.style.color = "";
            }, 3600);
        } else {
            window.alert(message);
        }
    }

    function inferMimeType(file) {
        const type = String(file?.type || "").toLowerCase();
        if (type) return type;
        if (/\.pdf$/i.test(String(file?.name || ""))) return "application/pdf";
        return "";
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

    function openAttachmentDB() {
        return new Promise(function (resolve, reject) {
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = function () {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = function () {
                resolve(request.result);
            };

            request.onerror = function () {
                reject(request.error || new Error("attachment_db_failed"));
            };
        });
    }

    async function saveAttachmentRecord(attachment) {
        const db = await openAttachmentDB();

        await new Promise(function (resolve, reject) {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            transaction.objectStore(STORE_NAME).put({
                id: attachment.id,
                name: attachment.name,
                size: attachment.size,
                mimeType: attachment.mimeType,
                kind: attachment.kind,
                dataUrl: attachment.dataUrl,
                savedAt: new Date().toISOString()
            }, attachment.id);

            transaction.oncomplete = resolve;
            transaction.onerror = function () {
                reject(transaction.error || new Error("attachment_save_failed"));
            };
        });

        db.close();
    }

    async function loadAttachmentRecord(id) {
        const db = await openAttachmentDB();

        const result = await new Promise(function (resolve, reject) {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const request = transaction.objectStore(STORE_NAME).get(id);
            request.onsuccess = function () {
                resolve(request.result || null);
            };
            request.onerror = function () {
                reject(request.error || new Error("attachment_load_failed"));
            };
        });

        db.close();
        return result;
    }

    async function selectAttachment(file) {
        if (!file) return;

        const mimeType = inferMimeType(file);
        if (!ALLOWED_TYPES.has(mimeType)) {
            showFileError("الملف غير مدعوم. اختر صورة أو ملف PDF.");
            return;
        }

        const isPdf = mimeType === "application/pdf";
        const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;

        if (file.size > maxBytes) {
            showFileError(isPdf
                ? "ملف PDF كبير جدًا. الحد الأقصى 10MB."
                : "الصورة كبيرة جدًا. الحد الأقصى 8MB."
            );
            return;
        }

        try {
            const dataUrl = await readFileAsDataURL(file);
            const commaIndex = dataUrl.indexOf(",");
            const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";

            if (!base64) throw new Error("empty_attachment_data");

            selectedAttachment = {
                id: makeId(),
                kind: isPdf ? "pdf" : "image",
                name: file.name || (isPdf ? "document.pdf" : "image"),
                size: file.size || 0,
                mimeType,
                base64,
                dataUrl
            };

            renderPreview();
        } catch (error) {
            console.error("Vertex attachment file error:", error);
            showFileError("تعذر قراءة الملف. اختر ملفًا آخر.");
        }
    }

    function clearSelectedAttachment() {
        selectedAttachment = null;

        const fileInput = document.getElementById("vertexVisionFileInput");
        if (fileInput) fileInput.value = "";

        renderPreview();
    }

    function renderPreview() {
        const preview = document.getElementById("vertexVisionPreview");
        const visual = document.getElementById("vertexVisionVisual");
        const name = document.getElementById("vertexVisionName");
        const meta = document.getElementById("vertexVisionMeta");
        const button = document.getElementById("vertexVisionButton");

        if (!preview || !visual || !name || !meta || !button) return;

        if (!selectedAttachment) {
            preview.classList.remove("visible");
            button.classList.remove("has-file");
            visual.innerHTML = "";
            name.textContent = "";
            meta.textContent = "";
            return;
        }

        preview.classList.add("visible");
        button.classList.add("has-file");
        name.textContent = selectedAttachment.name;
        meta.textContent = (selectedAttachment.kind === "pdf" ? "PDF جاهز للتحليل" : "صورة جاهزة للتحليل") +
            " • " + formatBytes(selectedAttachment.size);

        if (selectedAttachment.kind === "pdf") {
            visual.innerHTML = '<span class="vertex-vision-pdf-icon">📄</span>';
        } else {
            visual.innerHTML = "";
            const image = document.createElement("img");
            image.className = "vertex-vision-thumb";
            image.src = selectedAttachment.dataUrl;
            image.alt = "معاينة الصورة المرفقة";
            visual.appendChild(image);
        }
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
        fileInput.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,application/pdf,.pdf";
        fileInput.hidden = true;
        document.body.appendChild(fileInput);

        const button = document.createElement("button");
        button.id = "vertexVisionButton";
        button.type = "button";
        button.className = "vertex-vision-button";
        button.title = "إرفاق صورة أو PDF";
        button.setAttribute("aria-label", "إرفاق صورة أو ملف PDF");
        button.textContent = "📎";

        if (clearButton) {
            tools.insertBefore(button, clearButton);
        } else {
            tools.prepend(button);
        }

        const preview = document.createElement("div");
        preview.id = "vertexVisionPreview";
        preview.className = "vertex-vision-preview";
        preview.innerHTML = `
            <div id="vertexVisionVisual" class="vertex-vision-thumb-wrap"></div>
            <div class="vertex-vision-info">
                <strong id="vertexVisionName"></strong>
                <span id="vertexVisionMeta"></span>
            </div>
            <button id="vertexVisionRemove" type="button" class="vertex-vision-remove" title="حذف الملف">✕</button>
        `;
        wrapper.insertBefore(preview, wrapper.firstChild);

        button.addEventListener("click", function () {
            fileInput.click();
        });

        fileInput.addEventListener("change", function () {
            selectAttachment(fileInput.files && fileInput.files[0]);
        });

        preview.querySelector("#vertexVisionRemove")?.addEventListener("click", clearSelectedAttachment);

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
            if (!file) return;

            const mimeType = inferMimeType(file);
            if (ALLOWED_TYPES.has(mimeType)) {
                event.preventDefault();
                selectAttachment(file);
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
                selectAttachment(file);
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
            console.warn("Vertex attachment history unavailable:", error);
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
            console.warn("Vertex attachment memories unavailable:", error);
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

    function detectTaskMode(text, attachment) {
        const value = String(text || "").toLowerCase();
        if (/(حل|واجب|تمرين|مسألة|مساله|سؤال|أسئلة|اسئلة|اختبار|اختر|homework|solve|exercise|question|worksheet)/u.test(value)) {
            return "homework";
        }
        if (/(اقرأ|اقرا|استخرج|انسخ|النص الموجود|وش مكتوب|ocr|transcribe|extract text|read the text)/u.test(value)) {
            return "ocr";
        }
        return attachment?.kind === "pdf" ? "document" : "vision";
    }

    async function persistAttachmentForLatestUserMessage(userText, attachment) {
        if (!attachment) return;

        try {
            await saveAttachmentRecord(attachment);
        } catch (error) {
            console.warn("Vertex attachment could not be saved in IndexedDB:", error);
            return;
        }

        try {
            if (typeof getActiveConversation !== "function") return;
            const conversation = getActiveConversation();
            if (!conversation || !Array.isArray(conversation.messages)) return;

            const latestUserMessage = [...conversation.messages]
                .reverse()
                .find(function (message) {
                    return message && message.role === "user";
                });

            if (!latestUserMessage) return;

            latestUserMessage.attachment = {
                id: attachment.id,
                kind: attachment.kind,
                name: attachment.name,
                size: attachment.size,
                mimeType: attachment.mimeType
            };

            if (typeof saveConversations === "function") {
                saveConversations();
            }

            setTimeout(renderConversationAttachments, 0);
        } catch (error) {
            console.warn("Vertex attachment metadata save failed:", error);
        }
    }

    function downloadDataUrl(dataUrl, filename) {
        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = filename || "vertex-file";
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    async function renderAttachmentCard(element, metadata) {
        if (!element || !metadata?.id) return;
        if (element.dataset.vertexAttachmentId === metadata.id) return;

        const content = element.querySelector(".message-content");
        if (!content) return;

        const record = await loadAttachmentRecord(metadata.id).catch(function () {
            return null;
        });

        if (!element.isConnected) return;
        element.dataset.vertexAttachmentId = metadata.id;

        const card = document.createElement("div");
        card.className = "vertex-chat-attachment";

        if (metadata.kind === "image" && record?.dataUrl) {
            const image = document.createElement("img");
            image.src = record.dataUrl;
            image.alt = metadata.name || "صورة مرفقة";
            image.loading = "lazy";
            card.appendChild(image);
        } else {
            const row = document.createElement("div");
            row.className = "vertex-chat-file-row";
            row.innerHTML = `
                <span class="vertex-chat-file-icon">${metadata.kind === "pdf" ? "📄" : "🖼️"}</span>
                <span class="vertex-chat-file-meta">
                    <strong>${escapeHtmlSafe(metadata.name || (metadata.kind === "pdf" ? "PDF" : "صورة"))}</strong>
                    <small>${metadata.kind === "pdf" ? "PDF" : "صورة"} • ${formatBytes(Number(metadata.size || 0))}</small>
                </span>
            `;
            card.appendChild(row);
        }

        if (record?.dataUrl) {
            const actions = document.createElement("div");
            actions.className = "vertex-chat-attachment-actions";
            const download = document.createElement("button");
            download.type = "button";
            download.textContent = "⬇️ حفظ الملف";
            download.addEventListener("click", function () {
                downloadDataUrl(record.dataUrl, metadata.name || "vertex-file");
            });
            actions.appendChild(download);
            card.appendChild(actions);
        }

        const messageActions = content.querySelector(".message-actions");
        if (messageActions) content.insertBefore(card, messageActions);
        else content.appendChild(card);
    }

    function escapeHtmlSafe(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function renderConversationAttachments() {
        try {
            if (typeof getActiveConversation !== "function") return;
            const conversation = getActiveConversation();
            if (!conversation || !Array.isArray(conversation.messages)) return;

            const userMessages = conversation.messages.filter(function (message) {
                return message?.role === "user";
            });

            const userElements = Array.from(document.querySelectorAll("#messagesContainer .message.user"));

            userMessages.forEach(function (message, index) {
                if (!message?.attachment || !userElements[index]) return;
                renderAttachmentCard(userElements[index], message.attachment);
            });
        } catch (error) {
            console.warn("Vertex attachment render failed:", error);
        }
    }

    async function analyzeAttachment(userText) {
        if (!selectedAttachment) {
            if (originalGenerateAIReply) {
                return await originalGenerateAIReply(userText);
            }
            throw new Error("vision_no_attachment");
        }

        const attachment = selectedAttachment;
        const attachmentForRequest = {
            mimeType: attachment.mimeType,
            base64: attachment.base64,
            name: attachment.name,
            kind: attachment.kind
        };

        await persistAttachmentForLatestUserMessage(userText, attachment);

        const client = await getSupabaseClient();
        const result = await client.functions.invoke("vertex-ai-vision", {
            body: {
                prompt: userText,
                mode: detectTaskMode(userText, attachment),
                messages: getConversationPayload(userText),
                memories: getMemoryPayload(),
                assistantName: getAssistantName(),
                attachment: attachmentForRequest
            }
        });

        if (result.error) {
            throw result.error;
        }

        const data = result.data || {};
        if (typeof data.reply !== "string" || !data.reply.trim()) {
            throw new Error(data.error || "empty_attachment_reply");
        }

        clearSelectedAttachment();

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
            console.warn("Vertex attachments: generateAIReply was not found.");
            return;
        }

        window.generateAIReply = async function (userText) {
            if (!selectedAttachment) {
                return await originalGenerateAIReply(userText);
            }

            return await analyzeAttachment(userText);
        };

        window.__vertexVisionInstalled = true;
    }

    function ensurePromptForAttachment() {
        if (!selectedAttachment) return;

        const input = document.getElementById("messageInput");
        if (!input || input.value.trim()) return;

        input.value = selectedAttachment.kind === "pdf"
            ? "حلّل ملف PDF هذا واشرح محتواه وأهم المعلومات الموجودة فيه."
            : "حلّل هذه الصورة واشرح أهم ما يظهر فيها.";
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function installSendHelpers() {
        const sendButton = document.getElementById("sendBtn");
        const input = document.getElementById("messageInput");

        sendButton?.addEventListener("click", function () {
            ensurePromptForAttachment();
        }, true);

        input?.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                ensurePromptForAttachment();
            }
        }, true);
    }

    function installAttachmentObserver() {
        const container = document.getElementById("messagesContainer");
        if (!container) return;

        const observer = new MutationObserver(function () {
            renderConversationAttachments();
        });

        observer.observe(container, {
            childList: true,
            subtree: true
        });

        renderConversationAttachments();
    }

    function start() {
        installStyles();
        buildUI();
        installVisionOverride();
        installSendHelpers();
        installAttachmentObserver();

        window.VertexVision = {
            hasImage: function () {
                return Boolean(selectedAttachment && selectedAttachment.kind === "image");
            },
            hasAttachment: function () {
                return Boolean(selectedAttachment);
            },
            clear: clearSelectedAttachment
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
