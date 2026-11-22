import { CONFIG } from '../../config.js';
import { buildEphemerisPrompt, COCKPIT_SYSTEM_PROMPT } from './prompt.js';

function extractJson(text) {
  if (!text) return null;
  let s = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch { return null; }
}

function withTimeout(signal, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'AbortError')), ms);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: ctrl.signal,
    done: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); },
  };
}

function versionScore(id) {
  const m = id.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// Routes requests: Groq (fast cockpit callouts) + Gemini (science) + Pollinations (keyless fallback).
export class AIRouter {
  constructor(keys) {
    this.keys = keys; // { gemini, groq } getters
    this.models = [CONFIG.GEMINI_DEFAULT_MODEL];
  }

  async discoverGeminiModels() {
    const key = this.keys.gemini();
    if (!key) return false;
    try {
      const res = await fetch(`${CONFIG.GEMINI_API_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const valid = (data.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((id) => !/(tts|embedding|transcribe|image|gemma|audio|live|vision|aqa)/.test(id));
      valid.sort((a, b) => {
        const d = versionScore(b) - versionScore(a);
        if (d) return d;
        const fa = a.includes('flash') ? 1 : 0;
        const fb = b.includes('flash') ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return (a.includes('preview') || a.includes('exp') ? 1 : 0) - (b.includes('preview') || b.includes('exp') ? 1 : 0);
      });
      if (valid.length) this.models = valid.slice(0, 6);
      return true;
    } catch (err) {
      console.warn('[AI] Model discovery failed, using default.', err.message);
      return false;
    }
  }

  async cockpitCallout(commandText, signal) {
    const key = this.keys.groq();
    if (!key) return null;
    const t = withTimeout(signal, 6000);
    try {
      const res = await fetch(CONFIG.GROQ_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: CONFIG.GROQ_FAST_MODEL,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: COCKPIT_SYSTEM_PROMPT },
            { role: 'user', content: commandText },
          ],
        }),
        signal: t.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return extractJson(data?.choices?.[0]?.message?.content);
    } catch {
      return null;
    } finally {
      t.done();
    }
  }

  async generateWorld(commandText, locale, signal, onStage) {
    const prompt = buildEphemerisPrompt(commandText, locale);
    const key = this.keys.gemini();
    if (key) {
      for (const model of this.models) {
        if (signal?.aborted) return null;
        onStage?.(`EPHEMERIS: ${model.toUpperCase()}`);
        const t = withTimeout(signal, CONFIG.GEMINI_TIMEOUT_MS);
        try {
          const res = await fetch(`${CONFIG.GEMINI_API_BASE}/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
            }),
            signal: t.signal,
          });
          if (!res.ok) continue;
          const data = await res.json();
          const json = extractJson(data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(''));
          if (json?.objects?.length) return { config: json, source: `Gemini · ${model}` };
        } catch (err) {
          if (signal?.aborted) return null;
        } finally {
          t.done();
        }
      }
    }
    // Keyless fallback
    onStage?.('EPHEMERIS: POLLINATIONS');
    const t = withTimeout(signal, CONFIG.POLLINATIONS_TIMEOUT_MS);
    try {
      const res = await fetch(CONFIG.POLLINATIONS_TEXT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], jsonMode: true }),
        signal: t.signal,
      });
      if (res.ok) {
        const json = extractJson(await res.text());
        if (json?.objects?.length) return { config: json, source: 'Pollinations' };
      }
    } catch { /* fall through */ } finally {
      t.done();
    }
    return null;
  }
}
