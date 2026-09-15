// Vertex AI voice sanitizer: speak words and useful punctuation, skip decorative symbols/emoji.
(function () {
    "use strict";

    if (window.__vertexVoiceSanitizerInstalled) return;
    window.__vertexVoiceSanitizerInstalled = true;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;

    const synth = window.speechSynthesis;
    const previousSpeak = synth.speak.bind(synth);

    function sanitizeSpeechText(value) {
        return String(value || "")
            // Code blocks, inline code markers and URLs should not be read aloud.
            .replace(/```[\s\S]*?```/g, " ")
            .replace(/https?:\/\/\S+/gi, " ")
            .replace(/www\.\S+/gi, " ")
            // Emoji, pictographs, flags and emoji joiners/variation selectors.
            .replace(/\p{Extended_Pictographic}/gu, " ")
            .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, " ")
            .replace(/[\u200D\uFE0E\uFE0F\u20E3]/g, " ")
            // Arrows, technical marks, enclosed symbols, geometric shapes and dingbats.
            .replace(/[\u2190-\u21FF\u2300-\u23FF\u2460-\u24FF\u25A0-\u27BF\u2B00-\u2BFF]/g, " ")
            // Common decorative / math / markup symbols that TTS may pronounce.
            .replace(/[★☆●○■□◆◇▲△▼▽✓✔✕✖✗✘☑☐•◦▪▫→←↑↓↔↕#>*_~`|{}\[\]^@©®™=+×÷±∞≈≠≤≥]/g, " ")
            // Remove repeated punctuation that can cause awkward spoken pauses.
            .replace(/[-–—_=]{2,}/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    window.VertexVoiceSanitizeText = sanitizeSpeechText;

    synth.speak = function (utterance) {
        try {
            const cleaned = sanitizeSpeechText(utterance?.text || "");
            if (!cleaned) return;
            utterance.text = cleaned;
        } catch (_) {}
        return previousSpeak(utterance);
    };
})();
