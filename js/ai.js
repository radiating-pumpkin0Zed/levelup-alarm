// ── AI Daily Debrief (Claude API) ──
import { state }            from './state.js';
import { SCHED }            from './data.js';
import { load, save, initDay } from './storage.js';
import { toast, addLog, openDebrief, closeDebrief } from './ui.js';
import { renderAll, xpFloat, getLvl } from './render.js';

const SYSTEM_PROMPT = `You are a brutally honest, darkly sarcastic productivity coach reviewing a CS student's daily progress.

The student is on a 2-month self-improvement plan: web development, DSA/LeetCode, typing practice, creative skills (pixel art/editing), and project building.

Your job:
- Be sarcastic, blunt, and call out failures by name — but humorously, not cruelly
- Use gaming or anime references since that's their vibe (feel free to mention grinding, side quests, boss fights, etc.)
- Call out the gap between their goals and actual output if it exists
- If they did well, give genuine (but still sarcastic) praise
- End with ONE specific, actionable thing they should do differently tomorrow
- Keep it under 180 words
- Write in flowing paragraphs, no bullet points
- Tone: like a tough older mentor who genuinely wants them to win but has zero tolerance for excuses

Do NOT be generic. Use the specific tasks and numbers they provide.`;

function buildPrompt(userText, completedTasks, failedTasks, totalTasks, funActs) {
  const completedNames = completedTasks.map(t => t.label).join(', ') || 'nothing';
  const failedNames    = failedTasks.map(t => t.label).join(', ')    || 'none';
  const funTxt         = funActs.length > 0
    ? `\nSide quests logged: ${funActs.map(f => `${f.label} (×${f.count})`).join(', ')}.`
    : '';

  return `Completed ${completedTasks.length}/${totalTasks} tasks today (${Math.round(completedTasks.length/totalTasks*100)}%).
Completed: ${completedNames}.
Failed: ${failedNames}.${funTxt}

What they say they did today:
"${userText}"

Now give them the honest debrief.`;
}

export async function submitDebrief() {
  const userText = document.getElementById('debrief-input').value.trim();
  if (!userText) { toast('EMPTY', 'Write something. Anything. What did you actually do?', false); return; }

  const d    = load();
  const key  = d.settings?.apiKey || '';
  if (!key) {
    document.getElementById('debrief-key-section').style.display = 'block';
    toast('API KEY NEEDED', 'Enter your Anthropic API key in the field below.', false, true);
    return;
  }

  const dy            = initDay(d, state.todayStr);
  const completedTasks= SCHED.filter(t => dy.tasks[t.id]==='complete');
  const failedTasks   = SCHED.filter(t => dy.tasks[t.id]==='failed');
  const funActs       = Object.entries(dy.funActs || {})
    .map(([id, count]) => ({ id, count, label: _getFunLabel(id) }))
    .filter(f => f.count > 0);

  const prompt = buildPrompt(userText, completedTasks, failedTasks, SCHED.length, funActs);

  // UI: loading state
  const btn = document.getElementById('debrief-submit');
  const out = document.getElementById('debrief-output');
  btn.disabled = true;
  btn.textContent = 'CONSULTING AI...';
  out.innerHTML = '<div class="debrief-loading">Analyzing your mediocrity...<span class="blink-cursor">█</span></div>';
  out.style.display = 'block';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data2 = await res.json();
    const text  = data2.content?.[0]?.text || 'No response.';

    out.innerHTML = `<div class="debrief-response">${text.replace(/\n/g,'<br/>')}</div>`;

    // Award XP for doing the debrief
    const pXP  = d.stats.totalXP || 0;
    const pLvl = getLvl(pXP);
    d.stats.totalXP = pXP + 35;
    save(d); state.data = d;
    renderAll();
    xpFloat(35, document.getElementById('debrief-panel'));
    const nLvl = getLvl(d.stats.totalXP);
    addLog('Daily debrief complete. +35 XP', 'lg');
    if (nLvl > pLvl) {
      const { lvlUp } = await import('./app.js');
      lvlUp(nLvl);
    }

  } catch (e) {
    out.innerHTML = `<div class="debrief-error">ERROR: ${e.message}<br/>Check your API key in settings.</div>`;
    addLog('Debrief API error: ' + e.message, 'lf');
  } finally {
    btn.disabled = false;
    btn.textContent = 'GET ROASTED ⚡';
  }
}

function _getFunLabel(id) {
  const acts = [
    {id:'anime',label:'Anime'},{id:'gaming',label:'Gaming'},{id:'walk',label:'Walk'},
    {id:'cook',label:'Cooking'},{id:'friends',label:'Friends'},{id:'read',label:'Reading'},
    {id:'movie',label:'Movie'},{id:'nap',label:'Nap'},{id:'music',label:'Music'},
    {id:'doomscroll',label:'Doomscroll'},{id:'junk',label:'Junk Food'},{id:'latebedtime',label:'Late Night'},
  ];
  return acts.find(a => a.id===id)?.label || id;
}