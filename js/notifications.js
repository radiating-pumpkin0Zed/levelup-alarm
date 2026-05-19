// ── Notification scheduling, firing, missed-alarm detection ──
import { state }              from './state.js';
import { SCHED }              from './data.js';
import { load, save, initDay }from './storage.js';
import { alarmBeep, penaltyBeep, completeBeep, vibrate } from './audio.js';
import { toast, addLog, setSt }from './ui.js';
import { renderAll, flashT, xpFloat, parseHM, msUntil } from './render.js';

export async function reqPerm() {
  if (!('Notification' in window)) {
    setSt('Notifications not supported. Use Chrome on Android / Safari 16.4+.', 'warn');
    toast('NOT SUPPORTED', 'Use Chrome on Android for best results.', false); return;
  }
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    state.notifOn = true;
    const b = document.getElementById('abtn');
    b.querySelector('span').textContent = '✅ ALARMS ARMED';
    b.disabled = true;
    setSt('ARMED — tap 💡 Wake Lock for reliability.', 'ok');
    addLog('Permission granted. Scheduling alarms...', 'lf');
    schedAll();
    toast('SYSTEM ARMED', 'Alarms active! Tap 💡 Wake Lock to keep screen on.', true);
  } else if (p === 'denied') {
    setSt('Blocked. Enable notifications in browser site settings.', 'warn');
    addLog('BLOCKED — Settings → Browser → Notifications → Allow.', 'lf');
    toast('BLOCKED', 'Settings → Apps → Browser → Notifications → Allow this site.', false);
  }
}

export function fireN(title, body, type = 'alarm') {
  toast(title, body, type==='complete', type==='warn');
  addLog(`NOTIF: ${title}`, type==='complete'?'lg':type==='penalty'?'lf':'ly');
  if (type==='alarm')    { alarmBeep();   vibrate([200,100,200]); }
  if (type==='penalty')  { penaltyBeep(); vibrate([300,100,300,100,300]); }
  if (type==='complete') { completeBeep();vibrate([100,50,200]); }
  if (!state.notifOn) return;
  if (type==='alarm'   && !state.alarmOn)   return;
  if (type==='penalty' && !state.penaltyOn) return;
  try {
    const n = new Notification(title, { body, tag:'lu3'+Date.now(), requireInteraction: type!=='complete' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) { addLog('Notif err: ' + e.message, 'lf'); }
}

export function schedAll() {
  state.handles.forEach(clearTimeout);
  state.handles = [];
  let armed = 0;
  SCHED.forEach((task, i) => {
    // Alarm at task start time
    const ms = msUntil(task.time);
    if (ms > 0 && ms < 24*3600*1000) {
      state.handles.push(setTimeout(() => {
        addLog(`⏰ ALARM: ${task.label}`, 'ly');
        fireN(`⏰ ${task.label}`, task.alarm, 'alarm');
      }, ms));
      armed++;
    }
    // Penalty when NEXT task starts
    if (task.penalty && task.penalty.length > 0) {
      const pms = i < SCHED.length-1 ? msUntil(SCHED[i+1].time) : msUntil(task.time) + 90*60000;
      if (pms > 0 && pms < 24*3600*1000) {
        state.handles.push(setTimeout(() => _applyPenalty(task), pms));
      }
    }
  });
  addLog(`${armed} alarms armed for today.`, 'lg');
}

function _applyPenalty(task) {
  const d  = load();
  const dy = initDay(d, state.todayStr);
  if (dy.tasks[task.id] !== 'pending') return;          // already handled
  if (!state.penaltyOn) return;
  dy.tasks[task.id] = 'failed';
  d.stats.totalXP   = Math.max(0, (d.stats.totalXP || 0) - 25);
  save(d); state.data = d;
  renderAll();
  flashT(task.id, 'r');
  xpFloat(-25, document.getElementById('ti-'+task.id));
  fireN(`💀 PENALTY: ${task.label}`, task.penalty + ' (−25 XP)', 'penalty');
  addLog(`PENALTY: ${task.label} — FAILED, −25 XP`, 'lf');
}

// Called when tab becomes visible — catches alarms missed in background
export function checkMissedAlarms() {
  const nm = nowM();
  const d  = load();
  const dy = d.days?.[state.todayStr];
  if (!dy) return;
  let missed = 0;
  SCHED.forEach((task, i) => {
    const nextM = i < SCHED.length-1 ? parseHM(SCHED[i+1].time) : parseHM(task.time)+90;
    const tasks = dy.tasks || dy;
    if (nm > nextM && tasks[task.id]==='pending' && task.penalty?.length > 0 && state.penaltyOn) {
      (dy.tasks || dy)[task.id] = 'failed';
      d.stats.totalXP = Math.max(0, (d.stats.totalXP||0) - 25);
      missed++;
      addLog(`MISSED (offline): ${task.label}`, 'lf');
    }
  });
  if (missed > 0) {
    save(d); state.data = d;
    renderAll();
    toast('⚠ MISSED TASKS', `${missed} task(s) failed while app was in background. −${missed*25} XP.`, false, true);
  }
}

// 30-second polling for when app is in foreground but timers lagged
export function startPeriodicCheck() {
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const nm = nowM(); const d = load();
    const dy = d.days?.[state.todayStr]; if (!dy) return;
    SCHED.forEach((task, i) => {
      const nextM = i<SCHED.length-1 ? parseHM(SCHED[i+1].time) : parseHM(task.time)+90;
      const tasks = dy.tasks || dy;
      if (nm > nextM && tasks[task.id]==='pending' && task.penalty?.length>0 && state.penaltyOn) {
        _applyPenaltyFromData(task, d, dy);
      }
    });
  }, 30000);
}

function _applyPenaltyFromData(task, d, dy) {
  const tasks = dy.tasks || dy;
  if (tasks[task.id] !== 'pending') return;
  tasks[task.id] = 'failed';
  d.stats.totalXP = Math.max(0, (d.stats.totalXP||0) - 25);
  save(d); state.data = d;
  renderAll(); flashT(task.id,'r');
  xpFloat(-25, document.getElementById('ti-'+task.id));
  fireN(`💀 PENALTY: ${task.label}`, task.penalty+' (−25 XP)', 'penalty');
  addLog(`PENALTY (poll): ${task.label}`, 'lf');
}

function nowM() { const n=new Date(); return n.getHours()*60+n.getMinutes(); }