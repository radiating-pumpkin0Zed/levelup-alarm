// ── Main app logic + boot ──
import { state }                     from './state.js';
import { SCHED, LEVELS, QUOTES, FUN_ACTS } from './data.js';
import { load, save, todayKey, initDay }    from './storage.js';
import { acquireWakeLock, toggleWakeLock, toggleSound } from './audio.js';
import { toast, addLog, setSt, openPanel, closePanel,
         openDebrief as _openDebrief, closeDebrief,
         setBg, togNotif, togPenalty, saveApiKey } from './ui.js';
import { renderAll, renderInsights, updClock,
         flashT, xpFloat, getLvl, getLvlInfo, msUntil } from './render.js';
import { reqPerm, fireN, schedAll, checkMissedAlarms, startPeriodicCheck } from './notifications.js';
import { submitDebrief } from './ai.js';

// ── Wrap openDebrief to sync stat counters ─────────────
function openDebrief() {
  _openDebrief();
  document.getElementById('db-done').textContent = document.getElementById('ctd').textContent;
  document.getElementById('db-fail').textContent = document.getElementById('ctf').textContent;
  document.getElementById('db-pend').textContent = document.getElementById('ctp').textContent;
}

// ── Expose globals for HTML onclick ────────────────────
window.markDone       = markDone;
window.markUndo       = markUndo;
window.logFunAct      = logFunAct;
window.logMood        = logMood;
window.reqPerm        = reqPerm;
window.openPanel      = openPanel;
window.closePanel     = closePanel;
window.openDebrief    = openDebrief;
window.closeDebrief   = closeDebrief;
window.submitDebrief  = submitDebrief;
window.setBg          = setBg;
window.togNotif       = togNotif;
window.togPenalty     = togPenalty;
window.saveApiKey     = saveApiKey;
window.toggleSound    = toggleSound;
window.toggleWakeLock = toggleWakeLock;
window.testN          = testN;
window.resetDay       = resetDay;
window.resetAll       = resetAll;
window.closeLvl       = closeLvl;

// ── Task completion ────────────────────────────────────
function markDone(id) {
  state.data = load();
  const dy   = initDay(state.data, state.todayStr);
  if (dy.tasks[id] === 'complete') return;
  const task = SCHED.find(t=>t.id===id); if (!task) return;

  const wasFail = dy.tasks[id] === 'failed';
  dy.tasks[id]  = 'complete';
  const xpGain  = wasFail ? Math.floor(task.xp*.5) : task.xp;
  const pXP     = state.data.stats.totalXP || 0;
  const pLvl    = getLvl(pXP);
  state.data.stats.totalXP = pXP + xpGain;

  if (SCHED.every(t=>dy.tasks[t.id]==='complete')) {
    state.data.stats.totalXP += 300;
    updStreak();
    fireN('🏆 ALL TASKS COMPLETE!','Every task done. +300 bonus XP. Streak extended!','complete');
    addLog('ALL DONE! +300 BONUS XP','lg');
  }
  save(state.data); renderAll();
  flashT(id,'g'); xpFloat(xpGain, document.getElementById('ti-'+id));
  fireN(`✅ DONE: ${task.label}`, `+${xpGain} XP${wasFail?' (partial)':'. Keep going.'}`, 'complete');
  addLog(`COMPLETE: ${task.label} (+${xpGain} XP)`,'lg');
  const nLvl = getLvl(state.data.stats.totalXP);
  if (nLvl > pLvl) lvlUp(nLvl);
}

function markUndo(id) {
  state.data = load();
  const dy   = initDay(state.data, state.todayStr);
  if (dy.tasks[id] !== 'complete') return;
  const task = SCHED.find(t=>t.id===id); if (!task) return;
  dy.tasks[id] = 'pending';
  state.data.stats.totalXP = Math.max(0,(state.data.stats.totalXP||0)-task.xp);
  save(state.data); renderAll();
  addLog(`UNDONE: ${task.label} (−${task.xp} XP)`,'ly');
}

// ── Mood tracking ──────────────────────────────────────
function logMood(taskId, type, value) {
  state.data = load();
  const dy   = initDay(state.data, state.todayStr);
  if (!dy.moods[taskId]) dy.moods[taskId] = { before:null, after:null };
  dy.moods[taskId][type] = value;
  save(state.data); renderAll();
  const MOOD_EMOJIS = ['','😩','😟','😐','🙂','⚡'];
  const label = type==='before' ? 'pre-task energy' : 'post-task mood';
  addLog(`MOOD (${taskId} ${type}): ${MOOD_EMOJIS[value]} (${value}/5)`,'ly');
  toast(`MOOD LOGGED ${MOOD_EMOJIS[value]}`, `${value}/5 ${label} recorded. This builds your pattern data.`, true);
}

// ── Fun activities ─────────────────────────────────────
function logFunAct(id) {
  const act = FUN_ACTS.find(a=>a.id===id); if (!act) return;
  state.data = load();
  const dy   = initDay(state.data, state.todayStr);
  dy.funActs[id] = (dy.funActs[id]||0)+1;
  const pXP   = state.data.stats.totalXP || 0;
  const pLvl  = getLvl(pXP);
  state.data.stats.totalXP = Math.max(0, pXP+act.xp);
  save(state.data); renderAll();
  const el = document.querySelector(`#fun-acts .fa-item:nth-child(${FUN_ACTS.indexOf(act)+1})`);
  xpFloat(act.xp, el);
  const msg = act.xp>0
    ? `${act.emoji} +${act.xp} XP for ${act.label}.`
    : `${act.emoji} ${act.xp} XP. ${act.label} is a trap and you know it.`;
  addLog(msg, act.xp>0?'ly':'lf');
  toast(act.xp>0?`SIDE QUEST: ${act.emoji}`:`BAD HABIT: ${act.emoji}`, msg, act.xp>0, act.xp<0);
  const nLvl = getLvl(state.data.stats.totalXP);
  if (nLvl > pLvl) lvlUp(nLvl);
}

// ── Streak ─────────────────────────────────────────────
function updStreak() {
  const y=new Date(); y.setDate(y.getDate()-1);
  const yk=`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
  const last=state.data.stats.lastDate;
  if (last===yk||!last) state.data.stats.streak=(state.data.stats.streak||0)+1;
  else if (last!==state.todayStr) state.data.stats.streak=1;
  state.data.stats.bestStreak=Math.max(state.data.stats.streak,state.data.stats.bestStreak||0);
  state.data.stats.lastDate=state.todayStr;
  save(state.data);
}

// ── Level up overlay ───────────────────────────────────
export function lvlUp(l) {
  const info = LEVELS.find(v=>v.l===l)||{n:'???'};
  document.getElementById('lvsub').textContent = `LEVEL ${l} — ${info.n}`;
  document.getElementById('lvo').style.display = 'flex';
  for(let i=0;i<16;i++){
    const s=document.createElement('div'); s.className='spark';
    s.style.left=Math.random()*100+'vw'; s.style.top=Math.random()*100+'vh';
    s.textContent=['⚡','✨','💥','🔥','⭐','🌟'][Math.floor(Math.random()*6)];
    document.body.appendChild(s); setTimeout(()=>s.remove(),1100);
  }
}
function closeLvl(){ document.getElementById('lvo').style.display='none'; }

// ── Misc ───────────────────────────────────────────────
function testN(){
  if(!state.notifOn){toast('ACTIVATE FIRST','Tap the ACTIVATE button first!',false);return;}
  const opts=[
    {t:'⚡ TEST ALARM',   b:'Alarms active. Zero excuses. None.'},
    {t:'💀 PENALTY TEST', b:'−25 XP. This is what a missed task looks like.'},
    {t:'⚒️ REMINDER',    b:'Are you testing this instead of working? Be honest.'},
  ];
  const o=opts[Math.floor(Math.random()*opts.length)];
  fireN(o.t,o.b,'alarm');
}

function resetDay(){
  if(!confirm("Reset ALL of today's tasks? Cannot be undone."))return;
  state.data=load(); delete state.data.days[state.todayStr]; save(state.data);
  state.data=load(); initDay(state.data,state.todayStr); save(state.data);
  renderAll(); addLog('Today reset.','ly'); toast('RESET','Fresh start.',true);
}

function resetAll(){
  if(!confirm('Delete ALL data? XP, streak, everything.'))return;
  localStorage.clear(); state.data=load();
  initDay(state.data,state.todayStr); save(state.data);
  renderAll(); closePanel(); addLog('All data wiped.','lf');
  toast('ALL DATA WIPED','Starting fresh. Prove it this time.',false);
}

function midCheck(){
  const k=todayKey();
  if(k!==state.todayStr){
    state.todayStr=k; state.data=load();
    initDay(state.data,state.todayStr); save(state.data);
    renderAll(); if(state.notifOn) schedAll();
    addLog('NEW DAY. Fresh schedule.','lg');
  }
}

// ── Visibility / wake lock ─────────────────────────────
document.addEventListener('visibilitychange', async()=>{
  if(document.visibilityState!=='visible') return;
  checkMissedAlarms();
  if(state.notifOn) schedAll();
  if(!state.wakeLock) acquireWakeLock().catch(()=>{});
});

// ── BOOT ───────────────────────────────────────────────
(async function boot(){
  state.todayStr = todayKey();
  state.data     = load();
  initDay(state.data, state.todayStr);
  save(state.data);

  const cfg = state.data.settings || {};
  if(cfg.bg)             setBg(cfg.bg);
  if(cfg.sound)          { state.soundOn=true; document.getElementById('sound-btn').textContent='🔊'; document.getElementById('tog-sound').className='toggle on'; }
  if(cfg.alarms===false) { state.alarmOn=false; document.getElementById('tog-notif').className='toggle'; }
  if(cfg.penalty===false){ state.penaltyOn=false; document.getElementById('tog-penalty').className='toggle'; }
  if(cfg.apiKey)         document.getElementById('api-key-input').placeholder='••• key saved •••';

  // Daily quote
  const q=QUOTES[new Date().getDate()%QUOTES.length];
  document.getElementById('quote-box').innerHTML=`"${q[0]}"<span>${q[1]}</span>`;

  updClock(); renderAll();
  setInterval(updClock, 1000);
  setInterval(()=>{ renderAll(); midCheck(); }, 20000);
  startPeriodicCheck();

  if('Notification' in window){
    if(Notification.permission==='granted'){
      state.notifOn=true;
      const b=document.getElementById('abtn');
      b.querySelector('span').textContent='✅ ALARMS ARMED';
      b.disabled=true;
      setSt('ARMED — tap 💡 Wake Lock for reliability.','ok');
      schedAll(); checkMissedAlarms();
      addLog('Alarms rescheduled.','lg');
    } else if(Notification.permission==='denied'){
      setSt('Notifications BLOCKED — enable in browser settings.','warn');
    } else {
      setSt('Tap ACTIVATE to arm the alarm system.','');
    }
  } else {
    setSt('Notifications not supported. Use Chrome on Android.','warn');
  }

  // Proper SW registration
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  addLog('System v3.1 boot complete.','lg');
})();