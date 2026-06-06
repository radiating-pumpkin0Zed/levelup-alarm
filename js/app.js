// ── Main app logic + boot ──
import { state }                     from './state.js';
import { SCHED, LEVELS, QUOTES, FUN_ACTS } from './data.js';
import { load, save, todayKey, initDay, parseDayKey }    from './storage.js';
import { acquireWakeLock, toggleWakeLock, toggleSound, undoBeep, missionBeep, bossBeep, badgeBeep } from './audio.js';
import { toast, addLog, setSt, openPanel, closePanel,
         openDebrief as _openDebrief, closeDebrief,
         setBg, togNotif, togPenalty } from './ui.js';
import { renderAll, renderInsights, updClock,
         flashT, xpFloat, getLvl, getWeeklyBossStatus, getDailyMissionStatus } from './render.js';
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
window.toggleSound    = toggleSound;
window.toggleWakeLock = toggleWakeLock;
window.testN          = testN;
window.resetDay       = resetDay;
window.resetAll       = resetAll;
window.closeLvl       = closeLvl;
window.logDsaProblems = logDsaProblems;
window.claimBossReward= claimBossReward;
window.claimDailyMission= claimDailyMission;
window.openTaskDetail = openTaskDetail;
window.closeTaskDetail= closeTaskDetail;
window.saveTaskNotes  = saveTaskNotes;
window.setTaskDifficulty = setTaskDifficulty;
window.addSubtask     = addSubtask;
window.toggleSubtask  = toggleSubtask;
window.deleteSubtask  = deleteSubtask;
window.startPomodoro  = startPomodoro;
window.pausePomodoro  = pausePomodoro;
window.resetPomodoro  = resetPomodoro;

// ── Task completion ────────────────────────────────────
function markDone(id) {
  state.data = load();
  const dy   = initDay(state.data, state.todayStr);
  if (dy.tasks[id] === 'complete') return;
  const task = SCHED.find(t=>t.id===id); if (!task) return;

  const wasFail = dy.tasks[id] === 'failed';
  dy.tasks[id]  = 'complete';
  const doneAt = new Date().toISOString();
  dy.completedAt[id] = doneAt;
  if (!dy.timeLogs[id]) dy.timeLogs[id] = {};
  if (!dy.timeLogs[id].startAt) dy.timeLogs[id].startAt = activePomodoroStart(dy.pomodoro?.[id]) || doneAt;
  dy.timeLogs[id].endAt = doneAt;
  pausePomodoroForDay(dy, id);
  const xpGain  = calculateTaskXp(task, dy.difficulty[id], wasFail);
  const pXP     = state.data.stats.totalXP || 0;
  const pLvl    = getLvl(pXP);
  state.data.stats.totalXP = pXP + xpGain;
  dy.xpAwards[id] = xpGain;

  if (SCHED.every(t=>dy.tasks[t.id]==='complete') && !dy.rewards.allComplete) {
    state.data.stats.totalXP += 300;
    dy.rewards.allComplete = true;
    recomputeStreak(state.data);
    fireN('🏆 ALL TASKS COMPLETE!','Every task done. +300 bonus XP. Streak extended!','complete');
    badgeBeep();
    addLog('ALL DONE! +300 BONUS XP. The schedule has been briefly humiliated.','lg');
  }
  tryAwardDailyMission(state.data);
  save(state.data); renderAll();
  flashT(id,'g'); xpFloat(xpGain, document.getElementById('ti-'+id));
  fireN(`✅ DONE: ${task.label}`, `+${xpGain} XP${wasFail?' (partial redemption arc).':'. A tiny responsible adult has appeared.'}`, 'complete');
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
  const xpLoss = dy.xpAwards?.[id] ?? task.xp;
  if (dy.xpAwards) delete dy.xpAwards[id];
  if (dy.completedAt) delete dy.completedAt[id];
  if (dy.timeLogs) delete dy.timeLogs[id];
  dy.undoCount = (dy.undoCount || 0) + 1;
  state.data.stats.totalXP = Math.max(0,(state.data.stats.totalXP||0)-xpLoss);
  if (dy.rewards?.allComplete) {
    dy.rewards.allComplete = false;
    state.data.stats.totalXP = Math.max(0, (state.data.stats.totalXP||0) - 300);
    recomputeStreak(state.data);
    addLog('ALL DONE bonus removed. The victory parade has been asked to leave.','ly');
  }
  revokeDailyMissionIfBroken(state.data);
  save(state.data); renderAll();
  undoBeep();
  addLog(`UNDONE: ${task.label} (−${xpLoss} XP). Time travel remains expensive.`,'ly');
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

// ── Task notes, subtasks, difficulty, Pomodoro ─────────────────
function openTaskDetail(id) {
  state.taskDetailId = id;
  renderTaskDetail();
  document.getElementById('task-overlay').classList.add('open');
  document.getElementById('task-panel').classList.add('open');
}

function closeTaskDetail() {
  document.getElementById('task-overlay').classList.remove('open');
  document.getElementById('task-panel').classList.remove('open');
}

function renderTaskDetail() {
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  const task = SCHED.find(t => t.id === state.taskDetailId);
  const el = document.getElementById('task-detail');
  if (!task || !el) return;

  const notes = escapeAttr(dy.notes?.[task.id] || '');
  const subs = dy.subtasks?.[task.id] || [];
  const diff = dy.difficulty?.[task.id] || 'normal';
  const log = dy.timeLogs?.[task.id] || {};
  const pom = normalizePomodoro(dy.pomodoro?.[task.id]);
  const status = dy.tasks?.[task.id] || 'pending';
  const subHtml = subs.length
    ? subs.map((s, i) => `<div class="subtask-row${s.done ? ' done' : ''}">
        <button class="subtask-check" onclick="toggleSubtask('${task.id}',${i})">${s.done ? '✓' : ''}</button>
        <div class="subtask-label">${escapeHtml(s.label)}</div>
        <button class="subtask-del" onclick="deleteSubtask('${task.id}',${i})">×</button>
      </div>`).join('')
    : '<div class="xp-empty">No subtasks yet.</div>';

  el.innerHTML = `
    <div class="task-detail-head">
      <div class="task-detail-emoji">${task.emoji}</div>
      <div>
        <div class="task-detail-title">${escapeHtml(task.label)}</div>
        <div class="task-detail-sub">${task.time} · ${task.xp} base XP · ${status.toUpperCase()}</div>
      </div>
    </div>
    <div class="panel-sec">POMODORO</div>
    <div class="pomo-box">
      <div class="pomo-time" id="task-pomo-time">${pomodoroText(pom)}</div>
      <div class="pomo-mode">${pom.running ? 'RUNNING' : 'PAUSED'} · ${pom.mode === 'break' ? '5 MIN BREAK' : '25 MIN WORK'} · ${Math.floor((pom.cycles || 0) / 2)} WORK BLOCKS</div>
      <div class="pomo-actions">
        <button class="mini-action${pom.running ? ' on' : ''}" onclick="startPomodoro('${task.id}')">START</button>
        <button class="mini-action" onclick="pausePomodoro('${task.id}')">PAUSE</button>
        <button class="mini-action" onclick="resetPomodoro('${task.id}')">RESET</button>
      </div>
    </div>
    <div class="time-proof">
      <div class="stat-card"><div class="stat-k">START</div><div class="stat-v">${formatTime(log.startAt) || '--:--'}</div></div>
      <div class="stat-card"><div class="stat-k">END</div><div class="stat-v">${formatTime(log.endAt) || '--:--'}</div></div>
    </div>
    <div class="panel-sec">TASK NOTES</div>
    <textarea class="task-textarea" id="task-notes-input" onblur="saveTaskNotes('${task.id}')" placeholder="What did you actually do today?">${notes}</textarea>
    <button class="debrief-submit" onclick="saveTaskNotes('${task.id}')">SAVE NOTES</button>
    <div class="panel-sec">SUBTASK CHECKLIST</div>
    <div id="subtask-list">${subHtml}</div>
    <div class="subtask-add">
      <input class="subtask-input" id="subtask-input" placeholder="Add a small proof step"/>
      <button class="mini-action" onclick="addSubtask('${task.id}')">ADD</button>
    </div>
    <div class="panel-sec">DIFFICULTY XP</div>
    <div class="diff-actions">
      ${difficultyButton(task.id, 'easy', diff, 'EASY')}
      ${difficultyButton(task.id, 'normal', diff, 'NORMAL')}
      ${difficultyButton(task.id, 'hard', diff, 'HARD')}
    </div>`;
}

function difficultyButton(id, val, current, label) {
  return `<button class="mini-action${current === val ? ' on' : ''}" onclick="setTaskDifficulty('${id}','${val}')">${label}</button>`;
}

function saveTaskNotes(id) {
  const input = document.getElementById('task-notes-input');
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  dy.notes[id] = input?.value || '';
  save(state.data);
  renderAll();
  if (state.taskDetailId === id) renderTaskDetail();
  addLog(`NOTES SAVED: ${id}`, 'ly');
}

function setTaskDifficulty(id, difficulty) {
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  const task = SCHED.find(t => t.id === id);
  if (!task) return;
  const oldAward = dy.xpAwards?.[id] || 0;
  dy.difficulty[id] = difficulty;
  if (dy.tasks[id] === 'complete') {
    const wasFail = oldAward > 0 && oldAward <= Math.floor(task.xp * .5);
    const newAward = calculateTaskXp(task, difficulty, wasFail);
    const delta = newAward - oldAward;
    dy.xpAwards[id] = newAward;
    state.data.stats.totalXP = Math.max(0, (state.data.stats.totalXP || 0) + delta);
    if (delta) xpFloat(delta, document.getElementById('ti-' + id));
    addLog(`DIFFICULTY: ${task.label} set to ${difficulty.toUpperCase()} (${delta >= 0 ? '+' : ''}${delta} XP adjustment)`, delta >= 0 ? 'lg' : 'ly');
  }
  save(state.data);
  renderAll();
  renderTaskDetail();
}

function addSubtask(id) {
  const input = document.getElementById('subtask-input');
  const label = (input?.value || '').trim();
  if (!label) return;
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  if (!dy.subtasks[id]) dy.subtasks[id] = [];
  dy.subtasks[id].push({ label, done:false, createdAt:new Date().toISOString() });
  save(state.data);
  renderAll();
  renderTaskDetail();
}

function toggleSubtask(id, index) {
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  const item = dy.subtasks?.[id]?.[index];
  if (!item) return;
  item.done = !item.done;
  save(state.data);
  renderAll();
  renderTaskDetail();
}

function deleteSubtask(id, index) {
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  if (!dy.subtasks?.[id]) return;
  dy.subtasks[id].splice(index, 1);
  save(state.data);
  renderAll();
  renderTaskDetail();
}

function startPomodoro(id) {
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  if (!dy.pomodoro[id]) dy.pomodoro[id] = { mode:'work', elapsed:0, running:false, cycles:0 };
  const pom = normalizePomodoro(dy.pomodoro[id]);
  if (!pom.running) {
    pom.running = true;
    pom.startedAt = new Date().toISOString();
    if (!dy.timeLogs[id]) dy.timeLogs[id] = {};
    if (!dy.timeLogs[id].startAt) dy.timeLogs[id].startAt = pom.startedAt;
  }
  dy.pomodoro[id] = pom;
  save(state.data);
  renderAll();
  renderTaskDetail();
}

function pausePomodoro(id) {
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  pausePomodoroForDay(dy, id);
  save(state.data);
  renderAll();
  renderTaskDetail();
}

function resetPomodoro(id) {
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  dy.pomodoro[id] = { mode:'work', elapsed:0, running:false, cycles:0 };
  save(state.data);
  renderAll();
  renderTaskDetail();
}

function calculateTaskXp(task, difficulty = 'normal', wasFail = false) {
  const base = wasFail ? Math.floor(task.xp * .5) : task.xp;
  const mult = difficulty === 'easy' ? .8 : difficulty === 'hard' ? 1.25 : 1;
  return Math.max(1, Math.round(base * mult));
}

function activePomodoroStart(pom) {
  return pom?.startedAt || null;
}

function normalizePomodoro(pom = {}) {
  return {
    mode: pom.mode === 'break' ? 'break' : 'work',
    elapsed: Math.max(0, Number(pom.elapsed) || 0),
    running: !!pom.running,
    startedAt: pom.startedAt || null,
    cycles: Math.max(0, Number(pom.cycles) || 0),
  };
}

function pausePomodoroForDay(day, id) {
  if (!day.pomodoro?.[id]) return;
  const pom = normalizePomodoro(day.pomodoro[id]);
  if (pom.running && pom.startedAt) {
    pom.elapsed += Math.max(0, Math.floor((Date.now() - new Date(pom.startedAt).getTime()) / 1000));
  }
  pom.running = false;
  pom.startedAt = null;
  day.pomodoro[id] = pom;
}

function tickPomodoros() {
  const data = load();
  const dy = initDay(data, state.todayStr);
  let changed = false;
  Object.keys(dy.pomodoro || {}).forEach(id => {
    const pom = normalizePomodoro(dy.pomodoro[id]);
    if (!pom.running || !pom.startedAt) return;
    const limit = pom.mode === 'break' ? 5 * 60 : 25 * 60;
    const elapsed = pom.elapsed + Math.max(0, Math.floor((Date.now() - new Date(pom.startedAt).getTime()) / 1000));
    if (elapsed >= limit) {
      const nextMode = pom.mode === 'work' ? 'break' : 'work';
      pom.mode = nextMode;
      pom.elapsed = elapsed - limit;
      pom.startedAt = new Date().toISOString();
      pom.cycles = (pom.cycles || 0) + 1;
      dy.pomodoro[id] = pom;
      changed = true;
      const task = SCHED.find(t => t.id === id);
      const title = nextMode === 'break' ? 'BREAK STARTED' : 'WORK BLOCK STARTED';
      addLog(`${title}: ${task?.label || id}`, nextMode === 'break' ? 'lg' : 'ly');
      toast(title, nextMode === 'break' ? '25 minutes banked. Take 5.' : 'Break over. Next 25 starts now.', nextMode === 'break');
    }
  });
  if (changed) {
    save(data);
    state.data = data;
    renderAll();
    if (state.taskDetailId) renderTaskDetail();
  }
  updatePomodoroUi();
}

function updatePomodoroUi() {
  const data = load();
  const dy = initDay(data, state.todayStr);
  document.querySelectorAll('.pomo-chip').forEach(el => {
    const id = el.dataset.task;
    el.textContent = chipPomodoroText(normalizePomodoro(dy.pomodoro?.[id]));
  });
  const detailTime = document.getElementById('task-pomo-time');
  if (detailTime && state.taskDetailId) {
    detailTime.textContent = pomodoroText(normalizePomodoro(dy.pomodoro?.[state.taskDetailId]));
  }
}

function chipPomodoroText(pom) {
  const txt = pomodoroText(pom);
  return `${pom.mode === 'break' ? 'BREAK' : 'WORK'} ${txt}`;
}

function pomodoroText(pom) {
  const limit = pom.mode === 'break' ? 5 * 60 : 25 * 60;
  const live = pom.running && pom.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(pom.startedAt).getTime()) / 1000)) : 0;
  const left = Math.max(0, limit - pom.elapsed - live);
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
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

// ── DSA problem counter ─────────────────────────────────────────
function logDsaProblems(count) {
  const n = Number(count) || 0;
  if (n <= 0) return;
  state.data = load();
  const dy = initDay(state.data, state.todayStr);
  dy.dsaProblems = (dy.dsaProblems || 0) + n;
  state.data.stats.dsaProblems = (state.data.stats.dsaProblems || 0) + n;
  tryAwardDailyMission(state.data);
  save(state.data); renderAll();
  missionBeep();
  addLog(`DSA PROBLEMS: +${n} solved (${state.data.stats.dsaProblems} total). Brain wrinkles pending.`,'lg');
  toast('DSA LOGGED', `+${n} problem${n===1?'':'s'} logged. Badge progress updated, ego mildly justified.`, true);
}

// ── Daily random mission ────────────────────────────────────────
function claimDailyMission() {
  state.data = load();
  initDay(state.data, state.todayStr);
  const awarded = tryAwardDailyMission(state.data);
  save(state.data); renderAll();
  if (!awarded) {
    const mission = getDailyMissionStatus(state.data, state.todayStr);
    toast('MISSION LOCKED', mission.claimed ? 'Already paid out today. Nice try, accountant.' : 'Finish the daily mission first.', false, true);
  }
}

function tryAwardDailyMission(data) {
  const dy = initDay(data, state.todayStr);
  const mission = getDailyMissionStatus(data, state.todayStr);
  if (!mission.complete || mission.claimed) return false;
  const pXP = data.stats.totalXP || 0;
  const pLvl = getLvl(pXP);
  data.stats.totalXP = pXP + mission.reward;
  data.dailyMissionRewards = data.dailyMissionRewards || {};
  data.dailyMissionRewards[state.todayStr] = { id:mission.id, reward:mission.reward, claimedAt:new Date().toISOString() };
  dy.rewards.dailyMission = mission.id;
  missionBeep();
  xpFloat(mission.reward, document.getElementById('daily-mission'));
  addLog(`DAILY MISSION CLEARED: ${mission.name} (+${mission.reward} XP)`,'lg');
  toast('DAILY MISSION CLEARED', `${mission.name}. +${mission.reward} XP. Look at you, weaponizing punctuality.`, true);
  const nLvl = getLvl(data.stats.totalXP);
  if (nLvl > pLvl) lvlUp(nLvl);
  return true;
}

function revokeDailyMissionIfBroken(data) {
  const entry = data.dailyMissionRewards?.[state.todayStr];
  if (!entry) return;
  const mission = getDailyMissionStatus(data, state.todayStr);
  if (mission.complete) return;
  data.stats.totalXP = Math.max(0, (data.stats.totalXP || 0) - (entry.reward || mission.reward));
  delete data.dailyMissionRewards[state.todayStr];
  const dy = initDay(data, state.todayStr);
  if (dy.rewards) delete dy.rewards.dailyMission;
  addLog('DAILY MISSION reward revoked. The app noticed the little undo maneuver.','ly');
}

// ── Weekly boss reward ──────────────────────────────────────────
function claimBossReward() {
  state.data = load();
  initDay(state.data, state.todayStr);
  const boss = getWeeklyBossStatus(state.data, state.todayStr);
  if (!boss.complete || boss.claimed) {
    toast('BOSS LOCKED', boss.claimed ? 'Reward already claimed this week.' : 'Finish the weekly challenge first.', false, true);
    return;
  }
  const pXP = state.data.stats.totalXP || 0;
  const pLvl = getLvl(pXP);
  state.data.stats.totalXP = pXP + boss.reward;
  state.data.bossRewards = state.data.bossRewards || {};
  state.data.bossRewards[boss.weekKey] = { id:boss.id, reward:boss.reward, claimedAt:new Date().toISOString() };
  save(state.data); renderAll();
  xpFloat(boss.reward, document.getElementById('boss-fight'));
  bossBeep();
  addLog(`BOSS CLEARED: ${boss.name} (+${boss.reward} XP). The weekly menace has been folded.`, 'lg');
  toast('BOSS CLEARED', `${boss.name} defeated. +${boss.reward} XP. Extremely unnecessary. Extremely good.`, true);
  const nLvl = getLvl(state.data.stats.totalXP);
  if (nLvl > pLvl) lvlUp(nLvl);
}

// ── Streak ─────────────────────────────────────────────
function recomputeStreak(data) {
  const fullDays = new Set(Object.entries(data.days || {})
    .filter(([, dy]) => dy?.tasks && SCHED.every(t => dy.tasks[t.id] === 'complete'))
    .map(([k]) => k));

  let cur = 0;
  for (let d = parseDayKey(state.todayStr); fullDays.has(dayKey(d)); d.setDate(d.getDate() - 1)) cur++;

  let best = 0;
  fullDays.forEach(k => {
    let run = 0;
    for (let d = parseDayKey(k); fullDays.has(dayKey(d)); d.setDate(d.getDate() - 1)) run++;
    best = Math.max(best, run);
  });

  const todayFull = fullDays.has(state.todayStr);
  data.stats.streak = todayFull ? cur : 0;
  data.stats.bestStreak = Math.max(data.stats.bestStreak || 0, best);
  data.stats.lastDate = todayFull ? state.todayStr : data.stats.lastDate;
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  recomputeStreak(state.data); save(state.data);
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
  // Daily quote
  const q=QUOTES[new Date().getDate()%QUOTES.length];
  const quoteBox = document.getElementById('quote-box');
  quoteBox.textContent = `"${q[0]}"`;
  const quoteSrc = document.createElement('span');
  quoteSrc.textContent = q[1];
  quoteBox.appendChild(quoteSrc);

  updClock(); renderAll();
  setInterval(updClock, 1000);
  setInterval(tickPomodoros, 1000);
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
