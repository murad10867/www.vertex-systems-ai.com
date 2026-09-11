// Vertex Voice natural speech tuning
(function () {
  "use strict";
  if (window.__vertexNaturalVoiceInstalled) return;
  window.__vertexNaturalVoiceInstalled = true;
  if (!("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;
  const originalSpeak = synth.speak.bind(synth);

  function scoreVoice(v, arabic) {
    const name = String(v.name || "").toLowerCase();
    const lang = String(v.lang || "").toLowerCase();
    let score = 0;
    if (arabic) {
      if (lang === "ar-sa") score += 120;
      else if (lang.startsWith("ar-sa")) score += 110;
      else if (lang.startsWith("ar")) score += 80;
    } else {
      if (lang === "en-us") score += 100;
      else if (lang.startsWith("en")) score += 70;
    }
    if (/natural|neural|online|microsoft|google|siri|enhanced/.test(name)) score += 35;
    if (/female|zira|salma|hoda|laila|layla/.test(name)) score += 8;
    if (v.localService === false) score += 5;
    return score;
  }

  function bestVoice(text) {
    const voices = synth.getVoices() || [];
    if (!voices.length) return null;
    const arabic = /[\u0600-\u06ff]/.test(String(text || ""));
    return voices.slice().sort((a, b) => scoreVoice(b, arabic) - scoreVoice(a, arabic))[0] || null;
  }

  synth.speak = function (utterance) {
    try {
      const text = String(utterance.text || "");
      const arabic = /[\u0600-\u06ff]/.test(text);
      const voice = bestVoice(text);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || (arabic ? "ar-SA" : "en-US");
      } else {
        utterance.lang = arabic ? "ar-SA" : "en-US";
      }
      utterance.rate = arabic ? 1.5 : 0.1;
      utterance.pitch = 1.03;
      utterance.volume = 1;
    } catch (_) {}
    return originalSpeak(utterance);
  };

  synth.getVoices();
  synth.addEventListener?.("voiceschanged", function () { synth.getVoices(); });
})();
