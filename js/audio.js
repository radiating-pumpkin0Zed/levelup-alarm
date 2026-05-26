// ── Web Audio API + Wake Lock ──
import { state } from './state.js';

export function initAudio() {
  if (!state.audioCtx)
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

export function beep(freq = 440, dur = 0.15, type = 'square', vol = 0.25) {
  if (!state.soundOn) return;
  try {
    initAudio();
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    const o = state.audioCtx.createOscillator();
    const g = state.audioCtx.createGain();
    o.connect(g); g.connect(state.audioCtx.destination);
    o.frequency.value = freq; o.type = type;
    g.gain.setValueAtTime(vol, state.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + dur);
    o.start(); o.stop(state.audioCtx.currentTime + dur);
  } catch (e) {}
}

export function alarmBeep()   { [440,550,660,880].forEach((f,i) => setTimeout(() => beep(f, 0.15), i*120)); }
export function penaltyBeep() { [220,180,150].forEach((f,i)     => setTimeout(() => beep(f, 0.25,'sawtooth'), i*150)); }
export function completeBeep(){ [440,660,880,1100].forEach((f,i) => setTimeout(() => beep(f, 0.1,'sine'), i*80)); }
export function undoBeep()    { [330,260].forEach((f,i)          => setTimeout(() => beep(f, 0.12,'triangle',0.18), i*90)); }
export function missionBeep() { [523,659,784,1047].forEach((f,i)=> setTimeout(() => beep(f, 0.13,'triangle',0.22), i*85)); }
export function bossBeep()    { [196,392,587,784,1175].forEach((f,i)=> setTimeout(() => beep(f, 0.16, i<2?'sawtooth':'square',0.24), i*105)); }
export function badgeBeep()   { [880,1175,1568].forEach((f,i)    => setTimeout(() => beep(f, 0.09,'sine',0.2), i*70)); }

export function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

export async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return false;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => {
      state.wakeLock = null;
      document.getElementById('wakelock-btn').classList.remove('wakelock-on');
    });
    document.getElementById('wakelock-btn').classList.add('wakelock-on');
    return true;
  } catch (e) { return false; }
}

export async function toggleWakeLock() {
  if (!('wakeLock' in navigator)) {
    // imported lazily to avoid circular dep
    const { toast } = await import('./ui.js');
    toast('NOT SUPPORTED', 'Wake Lock not supported on this browser.', false);
    return;
  }
  const { toast, addLog } = await import('./ui.js');
  if (state.wakeLock) {
    try { await state.wakeLock.release(); } catch (e) {}
    state.wakeLock = null;
    document.getElementById('wakelock-btn').classList.remove('wakelock-on');
    toast('WAKE LOCK OFF', 'Screen may sleep. Alarms might miss.', false);
    addLog('Wake lock released.', 'ly');
  } else {
    const ok = await acquireWakeLock();
    if (ok) { toast('WAKE LOCK ON', 'Screen will stay on. Alarms will fire. ✅', true); addLog('Wake lock acquired.', 'lg'); }
    else     { toast('WAKE LOCK FAILED', 'Could not acquire wake lock.', false); }
  }
}

export async function toggleSound() {
  const { load, save } = await import('./storage.js');
  const { toast } = await import('./ui.js');
  state.soundOn = !state.soundOn;
  const d = load(); d.settings = d.settings || {}; d.settings.sound = state.soundOn; save(d);
  document.getElementById('sound-btn').textContent = state.soundOn ? '🔊' : '🔇';
  document.getElementById('tog-sound').className = 'toggle' + (state.soundOn ? ' on' : '');
  if (state.soundOn) { initAudio(); missionBeep(); }
  toast(state.soundOn ? 'SOUND ON' : 'SOUND OFF', state.soundOn ? 'Arcade noises activated. Very serious productivity technology.' : 'Silent mode. The drama remains internal.', true);
}
