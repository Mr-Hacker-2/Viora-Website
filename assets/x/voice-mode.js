/* Viora Voice: the interface.

   Three things live here, all talking to the chat app only through the small `host` object that app.html passes in:
   1. Microphone button: dictation. Records, transcribes, puts the words in the message box for the person to check and send.
   2. Voice Mode: a hands-free conversation. Listen -> transcribe -> send like a normal message -> speak the reply -> listen again.
      The message goes through the app's normal send, so it uses the chosen assistant and is saved in chat history like any other.
   3. Spoken replies: a speaker button on every answer (with pause and stop) and the Voice settings.

   host = { api, token(), send(text) -> Promise, busy(), stop(), assistant(), assistantName(), chatId(), message(chatId, index) -> {content}|null, toast(text) }
   The app also dispatches `viora:reply-done` ({ chatId, index, ok, text }) on window when an answer has finished. */
import { Recorder, transcribeAudio, mergeTranscript, micSupport, VoiceInputError } from './voice-input.js';
import { TTSManager, speechText } from './voice-tts.js';

const SETTINGS_KEY = 'viora_voice';
const DEFAULT_SETTINGS = { mode: true, speak: true, auto: true, voiceURI: '', rate: 1 };

export function loadSettings(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}'); return normalizeSettings(v); } catch { return { ...DEFAULT_SETTINGS }; }
}
export function normalizeSettings(v) {
  const s = { ...DEFAULT_SETTINGS };
  if (v && typeof v === 'object') {
    for (const k of ['mode', 'speak', 'auto']) if (typeof v[k] === 'boolean') s[k] = v[k];
    if (typeof v.voiceURI === 'string') s.voiceURI = v.voiceURI.slice(0, 200);
    const r = Number(v.rate); if (Number.isFinite(r)) s.rate = Math.min(1.5, Math.max(0.7, r));
  }
  return s;
}
export const mmss = sec => Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');

export const VM_TEXT = {
  ready: ['Tap to talk', 'Viora will answer out loud'],
  listening: ['Listening…', 'Stop talking and I will answer. Tap to finish now'],
  transcribing: ['Processing your speech…', 'Tap to cancel'],
  thinking: ['Viora is thinking…', 'Tap to stop'],
  speaking: ['Speaking…', 'Tap to interrupt'],
  error: ['Something went wrong', 'Tap to try again']
};

const I = {
  mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  pause: '<path d="M8 5.5v13M16 5.5v13"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  speaker: '<path d="M11 5L6 9H2.5v6H6l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  speakerOff: '<path d="M11 5L6 9H2.5v6H6l5 4zM16 9.5l5 5M21 9.5l-5 5"/>',
  wave: '<path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>'
};
const svg = (name, size = 20, cls = '') => `<svg${cls ? ' class="' + cls + '"' : ''} viewBox="0 0 24 24"${size ? ` width="${size}" height="${size}"` : ''} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[name]}</svg>`;
const $ = (s, r = document) => r.querySelector(s);

export function initVoice(host, { win = window, doc = document } = {}) {
  const cfg = win.VIORA_VOICE_CONFIG || {};
  const tts = new TTSManager();
  if (!tts.supported) doc.documentElement.classList.add('vv-no-tts'); // browsers without speech synthesis get no speaker buttons
  let settings = loadSettings();
  const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };
  const mic = micSupport(win);
  const key = (chatId, i) => chatId + ':' + i;

  /* ================= 1. dictation ================= */
  const micBtn = $('#mic'), bar = $('#vi-bar'), barText = $('#vi-text'), barMeter = bar ? $('.vi-meter i', bar) : null, input = $('#input');
  const dict = { state: 'idle', rec: null, ctl: null, undo: null, hideTimer: 0 };
  /* Live waveform for the recording pill: one thin bar per 50 ms level sample, newest on the right. */
  const wave = $('#vi-wave'), timeEl = $('#vi-time'); const levels = [];
  function drawWave() {
    if (!wave || !wave.isConnected || wave.offsetWidth === 0) return;
    const dpr = win.devicePixelRatio || 1, w = wave.clientWidth, h = wave.clientHeight;
    if (wave.width !== Math.round(w * dpr)) { wave.width = Math.round(w * dpr); wave.height = Math.round(h * dpr); }
    const g = wave.getContext('2d'); if (!g) return; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const step = 6, n = Math.max(8, Math.floor(w / step)), mid = h / 2;
    g.fillStyle = getComputedStyle(wave).color; g.lineCap = 'round'; g.lineWidth = 2.2; g.strokeStyle = g.fillStyle;
    for (let i = 0; i < n; i++) {
      const v = levels[levels.length - n + i] || 0, half = Math.max(1.2, Math.min(mid - 1, Math.sqrt(v) * mid * 1.15));
      const x = w - (n - i) * step + step / 2; g.globalAlpha = v < .03 ? .45 : 1;
      g.beginPath(); g.moveTo(x, mid - half); g.lineTo(x, mid + half); g.stroke();
    }
    g.globalAlpha = 1;
  }

  const showBar = (kind, text, { done = false, cancel = false, undo = false, dismiss = false } = {}) => {
    if (!bar) return; clearTimeout(dict.hideTimer);
    bar.hidden = false; bar.dataset.kind = kind; barText.textContent = text;
    $('#vi-done').hidden = !done; $('#vi-cancel').hidden = !cancel; $('#vi-undo').hidden = !undo; $('#vi-dismiss').hidden = !dismiss;
  };
  const hideBar = (after = 0) => { clearTimeout(dict.hideTimer); const go = () => { if (bar) { bar.hidden = true; bar.dataset.kind = ''; } }; after ? (dict.hideTimer = setTimeout(go, after)) : go(); };
  const setMicUi = (state) => {
    dict.state = state; if (!micBtn) return;
    micBtn.classList.toggle('rec', state === 'recording'); micBtn.classList.toggle('busy', state === 'transcribing' || state === 'starting');
    micBtn.setAttribute('aria-pressed', String(state === 'recording'));
    micBtn.setAttribute('aria-label', state === 'recording' ? 'Stop recording' : state === 'transcribing' ? 'Cancel transcription' : 'Dictate a message with your microphone');
    micBtn.title = state === 'recording' ? 'Stop recording' : state === 'transcribing' ? 'Cancel' : 'Speak your message';
    micBtn.innerHTML = state === 'recording' ? svg('stop') : svg('mic');
    if (!state || state === 'idle') micBtn.style.removeProperty('--lvl');
  };
  const fail = (e, where = 'dict') => {
    const msg = e instanceof VoiceInputError ? e.message : 'Voice input failed. Try again.';
    if (where === 'dict') { setMicUi('idle'); showBar('error', msg, { dismiss: true }); hideBar(9000); }
    return msg;
  };

  async function startDictation() {
    if (dict.state !== 'idle') return;
    tts.stop(); // a new voice interaction silences Viora
    if (!mic.ok) { showBar('error', mic.message, { dismiss: true }); return; }
    setMicUi('starting'); showBar('info', 'Starting the microphone…', { cancel: true });
    const rec = new Recorder({
      maxSeconds: cfg.maxSeconds || 300,
      onLevel: l => { micBtn?.style.setProperty('--lvl', l.toFixed(3)); barMeter?.style.setProperty('--lvl', l.toFixed(3)); levels.push(l); if (levels.length > 240) levels.splice(0, levels.length - 120); drawWave(); },
      onTick: sec => { if (dict.state === 'recording') { barText.textContent = 'Recording ' + mmss(sec) + '. Tap the mic or Done when finished'; if (timeEl) timeEl.textContent = mmss(sec); } },
      onAutoStop: reason => { if (reason === 'max_length') finishDictation(); },
      onError: e => { if (dict.rec === rec) { dict.rec = null; fail(e); } }
    }, win);
    dict.rec = rec;
    try { await rec.start(); } catch (e) { if (dict.rec === rec) { dict.rec = null; if (e.code === 'cancelled') { setMicUi('idle'); hideBar(); } else fail(e); } return; }
    if (dict.rec !== rec) { rec.cancel(); return; }
    levels.length = 0; if (timeEl) timeEl.textContent = '0:00'; setMicUi('recording'); showBar('rec', 'Recording 0:00. Tap the mic or Done when finished', { done: true, cancel: true });
  }
  async function finishDictation() {
    const rec = dict.rec; if (!rec || dict.state !== 'recording') return;
    dict.rec = null; setMicUi('transcribing'); showBar('busy', 'Transcribing…', { cancel: true });
    const out = await rec.stop();
    if (!out || dict.state !== 'transcribing') return;
    if (!out.heardSpeech || out.blob.size < 800 || out.durationMs < 350) { setMicUi('idle'); showBar('error', 'I did not hear anything. Check your microphone and try again.', { dismiss: true }); hideBar(7000); return; }
    const ctl = dict.ctl = new AbortController();
    try {
      const r = await transcribeAudio(out.blob, { api: host.api, token: host.token(), signal: ctl.signal });
      if (dict.ctl !== ctl) return;
      if (r.empty) { setMicUi('idle'); showBar('error', 'I did not catch any words. Try again a little closer to the microphone.', { dismiss: true }); hideBar(7000); return; }
      const before = input.value, merged = mergeTranscript(before, r.text, input.selectionStart ?? null, input.selectionEnd ?? null);
      input.value = merged.value; input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus(); try { input.setSelectionRange(merged.caret, merged.caret); } catch {}
      dict.undo = before; setMicUi('idle');
      const shown = r.text.length > 110 ? r.text.slice(0, 107) + '…' : r.text;
      showBar('ok', 'Heard: “' + shown + '”. Edit it below if needed, then send', { undo: true, dismiss: true }); hideBar(20000);
    } catch (e) {
      if (e.code === 'cancelled' || dict.ctl !== ctl) return;
      if (e.code === 'auth') { host.toast('Please sign in again.'); }
      fail(e);
    } finally { if (dict.ctl === ctl) dict.ctl = null; }
  }
  function cancelDictation(message = '') {
    if (dict.rec) { dict.rec.cancel(); dict.rec = null; }
    if (dict.ctl) { dict.ctl.abort(); dict.ctl = null; }
    setMicUi('idle'); message ? (showBar('info', message), hideBar(1600)) : hideBar();
  }
  if (micBtn) {
    if (!mic.ok && mic.code === 'unsupported') micBtn.hidden = true; else micBtn.hidden = false;
    setMicUi('idle');
    micBtn.addEventListener('click', () => { if (dict.state === 'recording') finishDictation(); else if (dict.state === 'transcribing' || dict.state === 'starting') cancelDictation('Cancelled'); else startDictation(); });
    $('#vi-done')?.addEventListener('click', finishDictation);
    $('#vi-cancel')?.addEventListener('click', () => cancelDictation('Cancelled'));
    $('#vi-dismiss')?.addEventListener('click', () => hideBar());
    $('#vi-undo')?.addEventListener('click', () => { if (dict.undo !== null) { input.value = dict.undo; input.dispatchEvent(new Event('input', { bubbles: true })); dict.undo = null; } hideBar(); input.focus(); });
    $('#composer')?.addEventListener('submit', () => { if (dict.state !== 'idle') cancelDictation(); else hideBar(); }, true); // sending while recording discards the recording
    input?.addEventListener('keydown', e => { if (e.key === 'Escape' && dict.state !== 'idle') { e.preventDefault(); cancelDictation('Cancelled'); } });
  }

  /* ================= 2. Voice Mode ================= */
  const vm = { open: false, state: 'ready', rec: null, ctl: null, empties: 0, turn: 0, restore: null, done: null, busyStart: false };
  let overlay = null;
  const speakEnabled = () => settings.speak && tts.supported;

  function buildOverlay() {
    overlay = doc.createElement('div'); overlay.id = 'vm'; overlay.className = 'vm'; overlay.hidden = true;
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Voice Mode');
    overlay.innerHTML =
      '<div class="vm-top"><span class="vm-badge">' + svg('wave', 16) + '<span>Voice Mode</span></span><span class="vm-asst" id="vm-asst"></span>' +
      '<button type="button" class="vm-x" id="vm-close" aria-label="Exit Voice Mode">' + svg('close') + '</button></div>' +
      '<div class="vm-stage">' +
        '<button type="button" class="vm-orb" id="vm-orb" data-state="ready" aria-describedby="vm-hint"><i class="vm-glow"></i><i class="vm-ring"></i><i class="vm-ring r2"></i><i class="vm-spin"></i><span class="vm-core" id="vm-core">' + svg('mic', 44) + '</span></button>' +
        '<p class="vm-status" id="vm-status" role="status" aria-live="polite">Tap to talk</p>' +
        '<p class="vm-hint" id="vm-hint"></p>' +
        '<div class="vm-caption" id="vm-caption" hidden></div>' +
      '</div>' +
      '<div class="vm-bottom">' +
        '<button type="button" class="vm-ctl" id="vm-pause" hidden aria-label="Pause speech">' + svg('pause') + '<span>Pause</span></button>' +
        '<button type="button" class="vm-ctl" id="vm-mute" aria-pressed="false" aria-label="Spoken replies on">' + svg('speaker') + '<span>Replies aloud</span></button>' +
        '<button type="button" class="vm-ctl vm-end" id="vm-end" aria-label="Exit Voice Mode">' + svg('close') + '<span>End</span></button>' +
      '</div>';
    doc.body.appendChild(overlay);
    $('#vm-orb', overlay).addEventListener('click', orbTap);
    $('#vm-close', overlay).addEventListener('click', closeVoiceMode);
    $('#vm-end', overlay).addEventListener('click', closeVoiceMode);
    $('#vm-pause', overlay).addEventListener('click', () => { tts.toggle(); });
    $('#vm-mute', overlay).addEventListener('click', () => { settings.speak = !settings.speak; save(); if (!settings.speak) tts.stop(); syncSettingsUi(); syncOverlayControls(); });
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeVoiceMode(); return; }
      if (e.key === 'Tab') { const f = [...overlay.querySelectorAll('button:not([hidden])')]; if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); } }
    });
  }
  function setVm(state, msg = '', caption) {
    vm.state = state; if (!overlay) return;
    const orb = $('#vm-orb', overlay), [label, hint] = VM_TEXT[state] || VM_TEXT.ready;
    orb.dataset.state = state; overlay.dataset.state = state;
    $('#vm-status', overlay).textContent = state === 'error' ? (msg || label) : label;
    $('#vm-hint', overlay).textContent = state === 'ready' && msg ? msg : hint;
    $('#vm-core', overlay).innerHTML = state === 'listening' ? svg('stop', 40) : state === 'speaking' ? svg('wave', 44) : svg('mic', 44);
    orb.setAttribute('aria-label', { ready: 'Start talking', listening: 'Finish speaking', transcribing: 'Cancel', thinking: 'Stop Viora', speaking: 'Interrupt Viora and talk', error: 'Try again' }[state] || 'Voice');
    if (state !== 'listening') orb.style.removeProperty('--lvl');
    if (caption !== undefined) { const c = $('#vm-caption', overlay); c.textContent = caption || ''; c.hidden = !caption; }
    syncOverlayControls();
  }
  function syncOverlayControls() {
    if (!overlay) return;
    const st = tts.state(), p = $('#vm-pause', overlay), m = $('#vm-mute', overlay);
    p.hidden = !(vm.state === 'speaking' && st.status !== 'idle');
    const paused = st.status === 'paused'; p.innerHTML = svg(paused ? 'play' : 'pause') + '<span>' + (paused ? 'Resume' : 'Pause') + '</span>'; p.setAttribute('aria-label', paused ? 'Resume speech' : 'Pause speech');
    m.hidden = !tts.supported; m.setAttribute('aria-pressed', String(!settings.speak)); m.innerHTML = svg(settings.speak ? 'speaker' : 'speakerOff') + '<span>' + (settings.speak ? 'Replies aloud' : 'Replies muted') + '</span>';
    m.setAttribute('aria-label', settings.speak ? 'Spoken replies on. Tap to mute' : 'Spoken replies muted. Tap to turn on');
  }

  function openVoiceMode() {
    if (vm.open) return;
    if (host.assistant() === 'human') { host.toast('Voice Mode is not available in the Humanizer. Pick another assistant.'); return; }
    if (!mic.ok) { host.toast(mic.message); return; }
    if (dict.state !== 'idle') cancelDictation();
    if (!overlay) buildOverlay();
    vm.open = true; vm.empties = 0; vm.restore = doc.activeElement;
    tts.prime(); // inside the tap, so the browser lets Viora speak automatically later
    $('#vm-asst', overlay).textContent = host.assistantName();
    overlay.hidden = false; doc.body.classList.add('vm-on'); setVm('ready', '', '');
    $('#vm-orb', overlay).focus();
    listen();
  }
  function closeVoiceMode() {
    if (!vm.open) return;
    vm.open = false; vm.turn++;
    if (vm.rec) { vm.rec.cancel(); vm.rec = null; }
    if (vm.ctl) { vm.ctl.abort(); vm.ctl = null; }
    tts.stop(); // an answer still being written finishes in the chat, silently
    overlay.hidden = true; doc.body.classList.remove('vm-on'); setVm('ready', '', '');
    try { (vm.restore && vm.restore.isConnected ? vm.restore : $('#vm-open'))?.focus(); } catch {}
  }

  async function listen(note = '') {
    if (!vm.open) return;
    tts.stop(); if (vm.ctl) { vm.ctl.abort(); vm.ctl = null; }
    const turn = ++vm.turn;
    setVm('listening', '', note);
    const rec = new Recorder({
      autoStop: true, maxSeconds: cfg.maxSeconds || 300, silenceMs: cfg.silenceMs, noSpeechMs: cfg.noSpeechMs,
      onLevel: l => { $('#vm-orb', overlay)?.style.setProperty('--lvl', l.toFixed(3)); },
      onAutoStop: reason => { if (vm.rec === rec) finishListening(turn, reason); },
      onError: e => { if (vm.rec === rec) { vm.rec = null; setVm('error', e.message, ''); } }
    }, win);
    vm.rec = rec;
    try { await rec.start(); } catch (e) { if (vm.rec === rec) { vm.rec = null; if (e.code !== 'cancelled') setVm('error', e.message, ''); } return; }
    if (!vm.open || vm.rec !== rec || vm.turn !== turn) rec.cancel();
  }
  async function finishListening(turn, reason) {
    const rec = vm.rec; if (!rec || vm.turn !== turn) return;
    vm.rec = null; setVm('transcribing', '', '');
    const out = await rec.stop();
    if (!vm.open || vm.turn !== turn) return;
    if (!out || !out.heardSpeech || out.blob.size < 800 || out.durationMs < 350) return nothingHeard(reason === 'no_speech' ? 'I did not hear anything.' : 'I did not catch that.');
    const ctl = vm.ctl = new AbortController();
    let text = '';
    try {
      const r = await transcribeAudio(out.blob, { api: host.api, token: host.token(), signal: ctl.signal });
      if (!vm.open || vm.turn !== turn) return;
      if (r.empty) return nothingHeard('I did not catch any words.');
      text = r.text;
    } catch (e) {
      if (e.code === 'cancelled' || vm.turn !== turn) return;
      if (e.code === 'auth') host.toast('Please sign in again.');
      return setVm('error', e.message, '');
    } finally { if (vm.ctl === ctl) vm.ctl = null; }
    vm.empties = 0;
    await converse(text, turn);
  }
  function nothingHeard(why) {
    vm.empties++;
    if (vm.empties >= 2) { setVm('ready', why + ' Tap the circle when you are ready to talk.', ''); return; } // stop re-listening forever in a silent room
    listen(why + ' Still listening…');
  }
  async function converse(text, turn) {
    setVm('thinking', '', '“' + (text.length > 160 ? text.slice(0, 157) + '…' : text) + '”');
    let finished = null;
    const onDone = e => { finished = e.detail; };
    win.addEventListener('viora:reply-done', onDone);
    try { await host.send(text); } catch { finished = null; } finally { win.removeEventListener('viora:reply-done', onDone); }
    if (!vm.open || vm.turn !== turn) return;
    if (!finished) { setVm('error', 'Viora could not send that. Try again.', ''); return; }
    if (!finished.ok) { setVm('error', 'Viora could not finish that answer. Tap to try again.', ''); return; }
    const reply = speechText(finished.text);
    if (!speakEnabled() || !reply) { setVm('ready', tts.supported ? 'Spoken replies are off.' : 'Your browser cannot speak replies.', ''); return; }
    setVm('speaking', '', '');
    const how = await tts.speak(reply, { id: key(finished.chatId, finished.index), voiceURI: settings.voiceURI, rate: settings.rate });
    if (!vm.open || vm.turn !== turn) return;                 // interrupted or exited: whoever did that already moved on
    if (how === 'error') { setVm('ready', 'I could not speak that. Tap to talk.', ''); return; }
    if (settings.auto) listen(); else setVm('ready', '', '');
  }
  function orbTap() {
    tts.prime();
    switch (vm.state) {
      case 'listening': if (vm.rec) finishListening(vm.turn, 'manual'); break;
      case 'transcribing': vm.turn++; if (vm.ctl) { vm.ctl.abort(); vm.ctl = null; } setVm('ready', '', ''); break;
      case 'thinking': vm.turn++; host.stop(); setVm('ready', 'Stopped. Tap to talk.', ''); break;
      case 'speaking': vm.turn++; tts.stop(); listen(); break;          // interrupt Viora and start listening at once
      default: vm.empties = 0; listen();
    }
  }
  const vmBtn = $('#vm-open');
  if (vmBtn) { vmBtn.addEventListener('click', openVoiceMode); }
  const syncVmButton = () => { if (vmBtn) vmBtn.hidden = !settings.mode || mic.code === 'unsupported'; if (!settings.mode && vm.open) closeVoiceMode(); };

  /* ================= 3. spoken replies and settings ================= */
  const nowChip = (() => {
    const c = $('#vv-now'); if (!c) return null;
    $('#vv-now-pause')?.addEventListener('click', () => tts.toggle()); $('#vv-now-stop')?.addEventListener('click', () => tts.stop());
    return c;
  })();
  const msgButtons = () => [...doc.querySelectorAll('.msg.assistant .msg-speak[data-speak]')];
  function applySpeakState() {
    const st = tts.state(), cid = host.chatId();
    if (st.status !== 'idle' && st.id && !String(st.id).startsWith(cid + ':') && !vm.open) { tts.stop(); return; } // the person moved to another chat
    for (const b of msgButtons()) {
      const active = st.status !== 'idle' && st.id === key(cid, Number(b.dataset.speak)), actions = b.parentElement;
      if (b.classList.contains('on') !== active) { b.classList.toggle('on', active); b.setAttribute('aria-pressed', String(active)); b.title = active ? 'Stop reading' : 'Read aloud'; b.setAttribute('aria-label', active ? 'Stop reading this reply' : 'Read this reply aloud'); b.innerHTML = svg(active ? 'stop' : 'speaker', 0, 'glyph'); }
      else if (!b.innerHTML) b.innerHTML = svg('speaker', 0, 'glyph');
      let pz = actions.querySelector('.msg-speak-pause');
      if (active && !pz) { pz = doc.createElement('button'); pz.type = 'button'; pz.className = 'msg-act msg-speak-pause'; pz.dataset.speakPause = b.dataset.speak; b.after(pz); }
      if (!active && pz) pz.remove();
      if (active && pz) { const paused = st.status === 'paused', want = paused ? 'play' : 'pause'; if (pz.dataset.icon !== want) { pz.dataset.icon = want; pz.innerHTML = svg(want, 0, 'glyph'); pz.title = paused ? 'Resume' : 'Pause'; pz.setAttribute('aria-label', paused ? 'Resume reading' : 'Pause reading'); } }
    }
    if (nowChip) {
      const show = st.status !== 'idle' && !vm.open; nowChip.hidden = !show;
      if (show) { const paused = st.status === 'paused'; $('#vv-now-text').textContent = paused ? 'Paused' : 'Speaking…'; $('#vv-now-pause').innerHTML = svg(paused ? 'play' : 'pause', 16); $('#vv-now-pause').setAttribute('aria-label', paused ? 'Resume' : 'Pause'); $('#vv-now-stop').innerHTML = svg('stop', 16); }
    }
    syncOverlayControls();
  }
  tts.subscribe(applySpeakState);
  const thread = $('#thread');
  if (thread) { let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; applySpeakState(); }); }).observe(thread, { childList: true, subtree: true }); }

  doc.addEventListener('click', e => {
    const sp = e.target.closest?.('.msg-speak[data-speak]');
    if (sp) {
      const cid = host.chatId(), i = Number(sp.dataset.speak), k = key(cid, i), st = tts.state();
      if (st.status !== 'idle' && st.id === k) { tts.stop(); return; }
      const m = host.message(cid, i); if (!m || !m.content) return;
      tts.prime(); tts.stop();
      tts.speak(speechText(m.content), { id: k, voiceURI: settings.voiceURI, rate: settings.rate });
      return;
    }
    const pz = e.target.closest?.('.msg-speak-pause'); if (pz) tts.toggle();
  });
  win.addEventListener('pagehide', () => tts.stop());
  win.addEventListener('viora:turn-start', () => { if (!vm.open) tts.stop(); }); // a new message silences the old answer

  /* settings dialog */
  const sMode = $('#vs-mode'), sSpeak = $('#vs-speak'), sAuto = $('#vs-auto'), sVoice = $('#vs-voice'), sRate = $('#vs-rate'), sRateV = $('#vs-rate-v'), sTest = $('#vs-test'), sNote = $('#vs-note');
  function fillVoices() {
    if (!sVoice) return;
    const base = (navigator.language || 'en').split('-')[0].toLowerCase(), all = tts.voices();
    const mine = all.filter(v => String(v.lang).toLowerCase().startsWith(base)), others = all.filter(v => !mine.includes(v));
    const opt = v => '<option value="' + String(v.voiceURI).replace(/"/g, '&quot;') + '">' + String(v.name).replace(/</g, '&lt;') + ' (' + v.lang + ')</option>';
    sVoice.innerHTML = '<option value="">Automatic (best available)</option>' + mine.map(opt).join('') + (others.length ? '<optgroup label="Other languages">' + others.map(opt).join('') + '</optgroup>' : '');
    sVoice.value = all.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : '';
  }
  function syncSettingsUi() {
    if (sMode) sMode.checked = settings.mode; if (sSpeak) sSpeak.checked = settings.speak; if (sAuto) sAuto.checked = settings.auto;
    if (sRate) { sRate.value = String(settings.rate); if (sRateV) sRateV.textContent = settings.rate.toFixed(2).replace(/0$/, '') + '×'; }
    const noTts = !tts.supported; for (const el of [sSpeak, sAuto, sVoice, sRate, sTest]) if (el) el.disabled = noTts;
    if (sNote) sNote.textContent = noTts ? 'This browser cannot speak replies. Voice Mode will show answers as text.' : '';
    syncVmButton();
  }
  if (sMode) {
    sMode.addEventListener('change', () => { settings.mode = sMode.checked; save(); syncSettingsUi(); });
    sSpeak.addEventListener('change', () => { settings.speak = sSpeak.checked; if (!settings.speak) tts.stop(); save(); syncOverlayControls(); });
    sAuto.addEventListener('change', () => { settings.auto = sAuto.checked; save(); });
    sVoice.addEventListener('change', () => { settings.voiceURI = sVoice.value; save(); });
    sRate.addEventListener('input', () => { settings.rate = normalizeSettings({ rate: sRate.value }).rate; sRateV.textContent = settings.rate.toFixed(2).replace(/0$/, '') + '×'; });
    sRate.addEventListener('change', save);
    sTest.addEventListener('click', () => { tts.prime(); tts.speak('Hi, I am Viora. This is how I sound.', { id: 'test', voiceURI: settings.voiceURI, rate: settings.rate }); });
    $('#open-settings')?.addEventListener('click', () => { fillVoices(); syncSettingsUi(); });
  }
  tts.onVoicesChanged(fillVoices); fillVoices(); syncSettingsUi();
  applySpeakState();

  return {
    tts, get settings() { return { ...settings }; }, openVoiceMode, closeVoiceMode, startDictation, finishDictation, cancelDictation,
    get state() { return { dictation: dict.state, voiceMode: vm.open ? vm.state : 'off' }; }, ttsSupported: tts.supported
  };
}
