// ── Local Daily Debrief ──
import { state }               from './state.js';
import { SCHED, FUN_ACTS }     from './data.js';
import { load, save, initDay } from './storage.js';
import { toast, addLog }       from './ui.js';
import { renderAll, xpFloat, getLvl } from './render.js';

function buildDebrief(userText, completedTasks, failedTasks, totalTasks, funActs) {
  const pct = Math.round(completedTasks.length / totalTasks * 100);
  const missedCore = failedTasks.filter(t => t.xp >= 40);
  const bestTask = completedTasks.slice().sort((a, b) => b.xp - a.xp)[0];
  const badActs = funActs.filter(f => f.xp < 0);
  const goodActs = funActs.filter(f => f.xp > 0);

  let opener;
  if (pct >= 85) {
    opener = `Solid clear today: ${completedTasks.length}/${totalTasks} tasks done (${pct}%). That is actual progress, not productivity cosplay.`;
  } else if (pct >= 55) {
    opener = `Mixed run: ${completedTasks.length}/${totalTasks} tasks done (${pct}%). You did enough to stay in the game, but the boss fight is still standing there.`;
  } else {
    opener = `Rough day: ${completedTasks.length}/${totalTasks} tasks done (${pct}%). The schedule did not lose. You dropped inputs. Annoying, fixable, very human.`;
  }

  const win = bestTask
    ? `Best move was finishing "${bestTask.label}" for ${bestTask.xp} XP. Keep protecting that kind of work tomorrow.`
    : `No completed main task means tomorrow needs one tiny guaranteed win before anything fancy.`;

  const failure = missedCore.length
    ? `The real leak was ${missedCore.map(t => `"${t.label}"`).join(', ')}. Those are high-value blocks, so missing them hurts more than skipping a tiny break task.`
    : failedTasks.length
      ? `The misses were smaller, but they still count. Little leaks become the whole flood if you keep blessing them.`
      : `No failed tasks logged. Beautiful. Suspiciously civilized.`;

  const sideQuest = badActs.length
    ? `Side quest warning: ${badActs.map(f => `${f.label} x${f.count}`).join(', ')}. Fun is fine; autopilot tax is not.`
    : goodActs.length
      ? `Side quests were sane: ${goodActs.map(f => `${f.label} x${f.count}`).join(', ')}. Recovery that does not hijack the day is a win.`
      : `No side quests logged, so either you were focused or the tracking button was simply invisible to your soul.`;

  const note = userText.length > 220 ? userText.slice(0, 220).trim() + '...' : userText;
  const action = missedCore[0]
    ? `Tomorrow: start "${missedCore[0].label}" with a 10-minute minimum timer. Once it starts, momentum can do its little magic trick.`
    : failedTasks[0]
      ? `Tomorrow: pre-decide the first 10 minutes of "${failedTasks[0].label}" so there is no negotiation at alarm time.`
      : `Tomorrow: repeat the same structure, but pick one task to make cleaner, earlier, or less dramatic.`;

  return `${opener}\n\n${win} ${failure}\n\n${sideQuest}\n\nYour note: "${note}"\n\n${action}`;
}

export async function submitDebrief() {
  const userText = document.getElementById('debrief-input').value.trim();
  if (!userText) {
    toast('EMPTY', 'Write something. Anything. What did you actually do?', false);
    return;
  }

  const d  = load();
  const dy = initDay(d, state.todayStr);
  const completedTasks = SCHED.filter(t => dy.tasks[t.id] === 'complete');
  const failedTasks    = SCHED.filter(t => dy.tasks[t.id] === 'failed');
  const funActs        = Object.entries(dy.funActs || {})
    .map(([id, count]) => ({ ..._getFunAct(id), count }))
    .filter(f => f.count > 0);

  const btn = document.getElementById('debrief-submit');
  const out = document.getElementById('debrief-output');
  btn.disabled = true;
  btn.textContent = 'ANALYZING...';
  out.style.display = 'block';
  out.replaceChildren(_el('div', 'debrief-loading', 'Analyzing the evidence...'));

  await new Promise(resolve => setTimeout(resolve, 250));

  const text = buildDebrief(userText, completedTasks, failedTasks, SCHED.length, funActs);
  out.replaceChildren(_el('div', 'debrief-response', text));

  if (!dy.rewards.debrief) {
    const pXP  = d.stats.totalXP || 0;
    const pLvl = getLvl(pXP);
    d.stats.totalXP = pXP + 35;
    dy.rewards.debrief = true;
    save(d); state.data = d;
    renderAll();
    xpFloat(35, document.getElementById('debrief-panel'));
    addLog('Daily debrief complete. +35 XP', 'lg');
    const nLvl = getLvl(d.stats.totalXP);
    if (nLvl > pLvl) {
      const { lvlUp } = await import('./app.js');
      lvlUp(nLvl);
    }
  } else {
    addLog('Daily debrief refreshed. XP already awarded today.', 'ly');
  }

  btn.disabled = false;
  btn.textContent = 'GENERATE DEBRIEF';
}

function _getFunAct(id) {
  return FUN_ACTS.find(a => a.id === id) || { id, label: id, xp: 0 };
}

function _el(tag, cls, text) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = text;
  return el;
}
