import { LANGUAGES, RTL_LOCALES } from './languages.js';

const $ = (id) => document.getElementById(id);

// Thin DOM layer. Keeps all element IDs from the original app.
export class UI {
  constructor() {
    this.el = {
      app: $('app-container'), sidebar: $('sidebar'), toggle: $('mobile-toggle-btn'),
      gemini: $('hf-token-input'), groq: $('groq-token-input'), save: $('save-token-btn'), tokenStatus: $('token-status'),
      lang: $('lang-select'), mic: $('mic-btn'), input: $('manual-input'), send: $('send-btn'), chips: $('destinations'),
      title: $('sector-title'), lore: $('sector-lore'), transcript: $('transcript'), source: $('source-label'),
      status: $('audio-status-text'), code: $('code-preview'), nav: $('hud-nav-status'),
      fps: $('hud-fps'), res: $('hud-res'), renderRes: $('render-res'), quality: $('quality-select'),
      boot: $('boot-overlay'), bootStatus: $('boot-status'), toast: $('toast'),
      target: $('target-card'), targetName: $('target-name'), targetMeta: $('target-meta'),
      targetFollow: $('target-follow'), targetClose: $('target-close'), systemView: $('system-view-btn'),
      capture: $('capture-btn'), captureLink: $('capture-link'), fullscreen: $('fullscreen-btn'),
    };
    for (const [code, label] of LANGUAGES) this.el.lang.add(new Option(label, code));

    this.el.toggle.addEventListener('click', () => this.setDrawer(!this.el.app.classList.contains('drawer-open')));
    this.el.fullscreen.addEventListener('click', () => this.toggleFullscreen());
  }

  setDrawer(open) {
    this.el.app.classList.toggle('drawer-open', open);
    this.el.toggle.setAttribute('aria-expanded', String(open));
  }

  setLocale(code) {
    this.el.lang.value = code;
    const rtl = RTL_LOCALES.has(code);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  }

  setStatus(text) { this.el.status.textContent = text; }
  setNav(text) { this.el.nav.textContent = text; }
  setBoot(text) { this.el.bootStatus.textContent = text; }
  hideBoot() { this.el.boot.classList.add('hidden'); }

  setTokenStatus(online, label) {
    this.el.tokenStatus.textContent = label || (online ? 'Linked' : 'Offline');
    this.el.tokenStatus.classList.toggle('ok', online);
  }

  setSector({ title, lore, source, config }) {
    this.el.title.textContent = title || 'Unknown sector';
    this.el.lore.textContent = lore || '';
    this.el.source.textContent = source || '';
    if (config) this.el.code.textContent = JSON.stringify(config, null, 2);
  }

  log(role, text) {
    const row = document.createElement('div');
    row.className = `line ${role}`;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = role === 'user' ? 'CMDR' : role === 'ai' ? 'SHIP' : 'SYS';
    const msg = document.createElement('span');
    msg.textContent = text;
    row.append(tag, msg);
    this.el.transcript.append(row);
    while (this.el.transcript.children.length > 40) this.el.transcript.firstChild.remove();
    this.el.transcript.scrollTop = this.el.transcript.scrollHeight;
  }

  toast(text, ms = 2600) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  setListening(on) { this.el.mic.classList.toggle('listening', on); }

  setBusy(on) {
    this.el.send.disabled = on;
    this.el.send.textContent = on ? 'Jumping…' : 'Engage';
  }

  showTarget(body) {
    if (!body) { this.el.target.hidden = true; return; }
    const labels = { star: 'Star', planet: 'Planet', gas_giant: 'Gas giant', spiral_galaxy: 'Spiral galaxy', nebula: 'Nebula', black_hole: 'Black hole', asteroid: 'Asteroid', comet: 'Comet', asteroid_belt: 'Asteroid belt' };
    const s = body.spec;
    const bits = [labels[body.kind] || body.kind];
    if (s.surface) bits.push(s.surface);
    if (s.temperature) bits.push(`${Math.round(s.temperature)} K`);
    bits.push(`r ${body.radius.toFixed(2)}`);
    this.el.targetName.textContent = body.name;
    this.el.targetMeta.textContent = bits.join(' · ');
    this.el.target.hidden = false;
  }

  setStats(engine) {
    const { w, h } = engine.drawingSize || { w: 0, h: 0 };
    this.el.fps.textContent = `${Math.round(engine.fps)} fps`;
    const res = `${w}×${h}`;
    this.el.res.textContent = res + (w >= 3800 ? ' · 4K' : '');
    this.el.renderRes.textContent = res;
  }

  renderChips(list, onPick) {
    this.el.chips.innerHTML = '';
    for (const [label, cmd] of list) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', () => onPick(cmd));
      this.el.chips.append(b);
    }
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.toast('Fullscreen is not available in this frame');
    }
  }
}
