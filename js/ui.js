// ── UI helpers: toast, log, status, panel, background ──
import { state } from './state.js';
import { load, save } from './storage.js';

// ── Toast ──────────────────────────────────────────────
let _toastTimer = null;
export function toast(title, body, ok = false, warn = false) {
  const t  = document.getElementById('toast');
  document.getElementById('ttl').textContent  = title;
  document.getElementById('tbody').textContent = body;
  t.className = 'toast' + (ok ? ' tok' : warn ? ' twarn' : '');
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), ok ? 4000 : 7000);
}

// ── Status bar ─────────────────────────────────────────
export function setSt(msg, type = '') {
  document.getElementById('stmsg').textContent = msg;
  document.getElementById('st').className = 'st' + (type === 'ok' ? ' ok' : type === 'warn' ? ' warn' : '');
}

// ── System log ─────────────────────────────────────────
export function addLog(msg, cls = '') {
  const a  = document.getElementById('log');
  const n  = new Date();
  const ts = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  const d  = document.createElement('div');
  const time = document.createElement('span');
  time.className = 'lt';
  time.textContent = `[${ts}]`;
  const body = document.createElement('span');
  body.className = cls;
  body.textContent = ` ${msg}`;
  d.append(time, body);
  a.insertBefore(d, a.firstChild);
  if (a.children.length > 50) a.removeChild(a.lastChild);
}

// ── Settings panel ─────────────────────────────────────
export function openPanel() {
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('panel').classList.add('open');
}
export function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('panel').classList.remove('open');
}

// ── Debrief panel ──────────────────────────────────────
export function openDebrief() {
  document.getElementById('debrief-overlay').classList.add('open');
  document.getElementById('debrief-panel').classList.add('open');
}
export function closeDebrief() {
  document.getElementById('debrief-overlay').classList.remove('open');
  document.getElementById('debrief-panel').classList.remove('open');
}

// ── Background ─────────────────────────────────────────
export function setBg(name) {
  state.currentBg = name;
  document.body.className = 'bg-' + name;
  document.querySelectorAll('.bg-opt').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById('bg-' + name);
  if (el) el.classList.add('selected');
  const d = load(); d.settings = d.settings || {}; d.settings.bg = name; save(d);
  addLog(`Background: ${name}`, 'ly');
}

// ── Toggles ────────────────────────────────────────────
export function togNotif() {
  state.alarmOn = !state.alarmOn;
  const d = load(); d.settings = d.settings || {}; d.settings.alarms = state.alarmOn; save(d);
  document.getElementById('tog-notif').className = 'toggle' + (state.alarmOn ? ' on' : '');
}
export function togPenalty() {
  state.penaltyOn = !state.penaltyOn;
  const d = load(); d.settings = d.settings || {}; d.settings.penalty = state.penaltyOn; save(d);
  document.getElementById('tog-penalty').className = 'toggle' + (state.penaltyOn ? ' on' : '');
}
