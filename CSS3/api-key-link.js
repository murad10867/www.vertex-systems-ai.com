// Compatibility bootstrap: API Key shortcut removed; load Vertex Voice instead.
(function () {
    "use strict";

    // Remove any stale API Key shortcut that an old cached script may have inserted.
    const staleApiButton = document.getElementById("vertexApiKeyCenterBtn");
    if (staleApiButton) staleApiButton.remove();

    // Load response sharing controls.
    function loadShareTools() {
        if (document.getElementById("vertexShareScript")) return;
        const share = document.createElement("script");
        share.id = "vertexShareScript";
        share.src = "ai-share.js?v=20260905-1";
        share.defer = true;
        document.body.appendChild(share);
    }

    loadShareTools();

    // Voice emblem: rounded square matching the Vertex V logo style.
    if (!document.getElementById("vertexVoiceSquareStyle")) {
        const style = document.createElement("style");
        style.id = "vertexVoiceSquareStyle";
        style.textContent = `
            .vertex-voice-orb {
                border-radius: 44px !important;
            }
            .vertex-voice-orb::before,
            .vertex-voice-orb::after {
                border-radius: inherit !important;
            }
            @media (max-width: 620px) {
                .vertex-voice-orb {
                    border-radius: 36px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function loadNaturalVoiceTuning() {
        if (document.getElementById("vertexNaturalVoiceScript")) return;
        const tuning = document.createElement("script");
        tuning.id = "vertexNaturalVoiceScript";
        tuning.src = "ai-voice-natural.js?v=20260905-4";
        document.body.appendChild(tuning);
    }

    if (document.getElementById("vertexVoiceScript")) {
        loadNaturalVoiceTuning();
        return;
    }

    const script = document.createElement("script");
    script.id = "vertexVoiceScript";
    script.src = "ai-voice.js?v=20260905-4";
    script.onload = loadNaturalVoiceTuning;
    script.defer = true;
    document.body.appendChild(script);
})();
