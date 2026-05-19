// ── localStorage helpers ──
import { SCHED } from './data.js';

const SK = 'lu_v3';

export function load() {
  try {
    const r = localStorage.getItem(SK);
    if (r) return JSON.parse(r);
  } catch (e) {}
  return {
    days:     {},
    stats:    { streak:0, bestStreak:0, totalXP:0, lastDate:null },
    settings: { sound:false, alarms:true, penalty:true, bg:'anime', apiKey:'' },
  };
}

export function save(d) {
  try { localStorage.setItem(SK, JSON.stringify(d)); } catch (e) {}
}

export function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

export function initDay(d, k) {
  if (!d.days[k]) {
    d.days[k] = { tasks:{}, funActs:{}, moods:{} };
    SCHED.forEach(t => { d.days[k].tasks[t.id] = 'pending'; });
  }
  // Migrate v2: tasks at root of day object
  if (!d.days[k].tasks) {
    const tasks = {};
    SCHED.forEach(t => { tasks[t.id] = d.days[k][t.id] || 'pending'; });
    d.days[k] = { tasks, funActs: d.days[k].funActs||{}, moods:{} };
  }
  if (!d.days[k].funActs) d.days[k].funActs = {};
  if (!d.days[k].moods)   d.days[k].moods   = {};
  return d.days[k];
}

// ── Pattern analysis helper ──────────────────────────
export function analyzePatterns(data) {
  const DOW_LABEL = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const days = Object.entries(data.days || {});
  // Need at least 3 historical days (not counting today)
  const todayK = todayKey();
  const histDays = days.filter(([k]) => k !== todayK);
  if (histDays.length < 3) return { ready: false, insights: [], moodInsights:[], taskStats:{} };

  // Per-task stats
  const taskStats = {};
  SCHED.forEach(t => {
    taskStats[t.id] = {
      id: t.id, label: t.label, emoji: t.emoji,
      total:0, completed:0, failed:0,
      byDow: Array(7).fill(0),       // completed per dow
      byDowTotal: Array(7).fill(0),  // attempted per dow
      moodsBefore: [], moodsAfter: [],
    };
  });

  // Day-of-week overall stats
  const dowStats = Array(7).fill(null).map(() => ({ total:0, completed:0 }));

  histDays.forEach(([dateKey, dayData]) => {
    const dow = new Date(dateKey).getDay();
    const tasks  = dayData.tasks  || dayData;
    const moods  = dayData.moods  || {};

    SCHED.forEach(t => {
      const s = tasks[t.id];
      if (!s || s === 'pending') return;
      taskStats[t.id].total++;
      taskStats[t.id].byDowTotal[dow]++;
      dowStats[dow].total++;
      if (s === 'complete') {
        taskStats[t.id].completed++;
        taskStats[t.id].byDow[dow]++;
        dowStats[dow].completed++;
      } else {
        taskStats[t.id].failed++;
      }
      // Mood data
      if (moods[t.id]) {
        if (moods[t.id].before) taskStats[t.id].moodsBefore.push(moods[t.id].before);
        if (moods[t.id].after)  taskStats[t.id].moodsAfter.push(moods[t.id].after);
      }
    });
  });

  const insights = [];

  // Task-level insights
  SCHED.forEach(t => {
    const s = taskStats[t.id];
    if (s.total < 3) return;
    const rate = s.completed / s.total;

    if (rate === 0)
      insights.push({ type:'danger', emoji:t.emoji, msg:`You have NEVER completed "${t.label}". 0 for ${s.total}. That is not a task issue. That is a you issue.` });
    else if (rate < 0.4)
      insights.push({ type:'warn', emoji:t.emoji, msg:`"${t.label}" fails ${Math.round((1-rate)*100)}% of the time (${s.failed}/${s.total}). This is your biggest weak point right now.` });
    else if (rate >= 0.9)
      insights.push({ type:'win', emoji:t.emoji, msg:`"${t.label}" is your most consistent task — ${Math.round(rate*100)}% completion. This habit is locked in.` });

    // Day-specific pattern
    for (let dow = 0; dow < 7; dow++) {
      if (s.byDowTotal[dow] >= 2) {
        const dayRate = s.byDow[dow] / s.byDowTotal[dow];
        if (dayRate === 0 && s.byDowTotal[dow] >= 2)
          insights.push({ type:'pattern', emoji:t.emoji, msg:`You always fail "${t.label}" on ${DOW_LABEL[dow]}s — 0% completion. Something happens that day that kills this task.` });
        else if (dayRate === 1 && s.byDowTotal[dow] >= 3)
          insights.push({ type:'win', emoji:t.emoji, msg:`You always complete "${t.label}" on ${DOW_LABEL[dow]}s — perfect record. Whatever you're doing that day, keep doing it.` });
      }
    }

    // Mood correlation
    if (s.moodsBefore.length >= 3) {
      const avgBefore = s.moodsBefore.reduce((a,b)=>a+b,0) / s.moodsBefore.length;
      const avgAfter  = s.moodsAfter.reduce((a,b)=>a+b,0)  / (s.moodsAfter.length||1);
      if (avgBefore < 2.5)
        insights.push({ type:'mood', emoji:'😩', msg:`You usually start "${t.label}" with low energy (avg ${avgBefore.toFixed(1)}/5). Consider moving it to a higher-energy time slot.` });
      if (s.moodsAfter.length >= 3 && avgAfter > avgBefore + 1)
        insights.push({ type:'mood', emoji:'⚡', msg:`"${t.label}" consistently boosts your mood (+${(avgAfter-avgBefore).toFixed(1)} pts avg). It feels bad to start but good to finish.` });
    }
  });

  // Best/worst day of week
  const validDows = dowStats.map((s,i)=>({i, ...s})).filter(s => s.total >= 3);
  if (validDows.length >= 2) {
    const best  = validDows.reduce((a,b) => (b.completed/b.total > a.completed/a.total ? b : a));
    const worst = validDows.reduce((a,b) => (b.completed/b.total < a.completed/a.total ? b : a));
    if (best.i !== worst.i) {
      insights.push({ type:'win',  emoji:'📅', msg:`Your best day is ${DOW_LABEL[best.i]} — ${Math.round(best.completed/best.total*100)}% avg completion. Schedule your hardest tasks then.` });
      insights.push({ type:'warn', emoji:'📅', msg:`Your worst day is ${DOW_LABEL[worst.i]} — only ${Math.round(worst.completed/worst.total*100)}% avg completion. Plan lighter on ${DOW_LABEL[worst.i]}s.` });
    }
  }

  // Sort: danger > warn > pattern > mood > win
  const order = { danger:0, warn:1, pattern:2, mood:3, win:4 };
  insights.sort((a,b) => order[a.type] - order[b.type]);

  return { ready: true, insights: insights.slice(0,8), taskStats };
}