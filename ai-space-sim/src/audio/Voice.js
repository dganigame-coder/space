import { CONFIG } from '../../config.js';

// Voice I/O: speech recognition in the selected locale and a TTS router
// (Groq Orpheus for short English callouts, Gemini TTS for long/multilingual, browser fallback).
export class Voice {
  constructor({ getLocale, keys, synth }) {
    this.getLocale = getLocale;
    this.keys = keys;
    this.synth = synth;
    this.current = null;
    this.enabled = true;
    this._last = '';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognitionSupported = !!SR;
    if (SR) {
      this.recognition = new SR();
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
    }
    if ('speechSynthesis' in window) {
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
  }

  listen({ onInterim, onFinal, onEnd }) {
    if (!this.recognition) return false;
    const r = this.recognition;
    r.lang = this.getLocale();
    r.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      if (final) onFinal?.(text.trim());
      else onInterim?.(text.trim());
    };
    r.onerror = () => onEnd?.();
    r.onend = () => onEnd?.();
    try { r.start(); return true; } catch { return false; }
  }

  stopListening() { try { this.recognition?.stop(); } catch { /* ignore */ } }

  stop() {
    if (this.current) { this.current.pause(); this.current = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.synth?.duck(false);
  }

  async say(text, { force = false } = {}) {
    if (!this.enabled || !text) return;
    if (!force && text === this._last) return;
    this._last = text;
    const isEnglish = this.getLocale().toLowerCase().startsWith('en');
    if (isEnglish && text.length <= 180 && this.keys.groq()) return this._groq(text);
    if (this.keys.gemini()) return this._gemini(text);
    return this._browser(text);
  }

  _play(audio) {
    this.stop();
    this.current = audio;
    this.synth?.duck(true);
    audio.onended = () => { if (this.current === audio) this.current = null; this.synth?.duck(false); };
    return audio.play();
  }

  _browser(text) {
    if (!('speechSynthesis' in window)) return;
    this.stop();
    const clean = text.replace(/^\[[^\]]+\]\s*/, '');
    const u = new SpeechSynthesisUtterance(clean);
    const locale = this.getLocale();
    u.lang = locale;
    const voices = speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang === locale) || voices.find((x) => x.lang.startsWith(locale.split('-')[0]));
    if (v) u.voice = v;
    u.pitch = 0.9;
    u.rate = 1.0;
    u.onstart = () => this.synth?.duck(true);
    u.onend = () => this.synth?.duck(false);
    speechSynthesis.speak(u);
  }

  async _groq(text) {
    try {
      const res = await fetch(CONFIG.GROQ_SPEECH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.keys.groq()}` },
        body: JSON.stringify({ model: CONFIG.GROQ_TTS_MODEL, voice: CONFIG.GROQ_TTS_VOICE, input: text.slice(0, 180), response_format: 'wav' }),
      });
      if (!res.ok) throw new Error(`Groq TTS ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      await this._play(audio);
    } catch (err) {
      console.warn('[VOICE] Groq fallback:', err.message);
      this._browser(text);
    }
  }

  async _gemini(text) {
    try {
      const model = text.length > 500 ? CONFIG.GEMINI_LONG_TTS_MODEL : CONFIG.GEMINI_LITE_TTS_MODEL;
      const res = await fetch(`${CONFIG.GEMINI_API_BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.keys.gemini() },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'] } }),
      });
      if (!res.ok) throw new Error(`Gemini TTS ${res.status}`);
      const data = await res.json();
      const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!inline?.data) throw new Error('no audio');
      const mime = inline.mimeType || '';
      let blob;
      if (/L16|pcm/i.test(mime)) {
        // Gemini returns raw 16-bit PCM; wrap it in a WAV container so browsers can play it.
        const rate = +(mime.match(/rate=(\d+)/)?.[1] || 24000);
        blob = pcmToWav(base64ToBytes(inline.data), rate);
      } else {
        blob = new Blob([base64ToBytes(inline.data)], { type: mime || 'audio/wav' });
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      await this._play(audio);
    } catch (err) {
      console.warn('[VOICE] Gemini fallback:', err.message);
      this._browser(text);
    }
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pcmToWav(pcm, sampleRate, channels = 1) {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, pcm.length, true);
  return new Blob([header, pcm], { type: 'audio/wav' });
}
