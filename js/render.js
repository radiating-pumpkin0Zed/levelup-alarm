// ── All DOM rendering ──
import { state }               from './state.js';
import { SCHED, LEVELS, FUN_ACTS } from './data.js';
import { load, initDay, analyzePatterns, parseDayKey } from './storage.js';
import { addLog }              from './ui.js';

export const MOOD_EMOJIS = ['','😩','😟','😐','🙂','⚡'];

export function getLvl(xp)     { let l=1; for(const v of LEVELS){ if(xp>=v.xp) l=v.l; } return l; }
export function getLvlInfo(xp) {
  let cur=LEVELS[0], next=null;
  for(let i=0;i<LEVELS.length;i++){ if(xp>=LEVELS[i].xp){ cur=LEVELS[i]; next=LEVELS[i+1]||null; } }
  return { cur, next };
}
export function parseHM(t) { const [h,m]=t.split(':').map(Number); return h*60+m; }
export function fmt12(t)   { const [h,m]=t.split(':').map(Number); const ap=h>=12?'PM':'AM'; return `${h%12||12}:${String(m).padStart(2,'0')} ${ap}`; }
export function nowM()     { const n=new Date(); return n.getHours()*60+n.getMinutes(); }
export function msUntil(t) { const [h,m]=t.split(':').map(Number); const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate(),h,m,0,0)-n; }

const DOW_LABEL = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function findCurIdx(nm) {
  let idx=-1;
  for(let i=0;i<SCHED.length;i++){ if(parseHM(SCHED[i].time)<=nm) idx=i; else break; }
  return idx;
}

// ── Mood picker HTML ────────────────────────────────────────────
function moodPickerHtml(taskId, type, current) {
  if (current) {
    return `<div class="mood-display"><span class="mood-lbl">${type==='before'?'START':'END'}:</span><span class="mood-val">${MOOD_EMOJIS[current]}</span></div>`;
  }
  const label = type === 'before' ? 'ENERGY NOW?' : 'HOW WAS IT?';
  const btns = [1,2,3,4,5].map(v =>
    `<button class="mood-btn" onclick="window.logMood('${taskId}','${type}',${v})" title="${MOOD_EMOJIS[v]}">${MOOD_EMOJIS[v]}</button>`
  ).join('');
  return `<div class="mood-picker"><span class="mood-lbl">${label}</span>${btns}</div>`;
}

// ── Main render ─────────────────────────────────────────────────
export function renderAll() {
  state.data = load();
  const dy  = initDay(state.data, state.todayStr);
  const nm  = nowM();

  // Day stats
  let done=0, fail=0, pend=0;
  SCHED.forEach(t => {
    const s = dy.tasks[t.id] || 'pending';
    if (s==='complete') done++; else if (s==='failed') fail++; else pend++;
  });
  document.getElementById('ctd').textContent = done;
  document.getElementById('ctf').textContent = fail;
  document.getElementById('ctp').textContent = pend;
  const pct = Math.round((done/SCHED.length)*100);
  document.getElementById('ppct').textContent = pct+'%';
  document.getElementById('pf').style.width   = pct+'%';

  // RPG stats
  const tXP = state.data.stats.totalXP || 0;
  const {cur,next} = getLvlInfo(tXP);
  document.getElementById('rxp').textContent   = tXP;
  document.getElementById('rlv').textContent   = cur.l;
  document.getElementById('rrank').textContent = cur.n;
  document.getElementById('rst').textContent   = state.data.stats.streak || 0;
  document.getElementById('rbest').textContent = 'BEST: '+(state.data.stats.bestStreak||0);
  if (next) {
    const xpIn=tXP-cur.xp, xpN=next.xp-cur.xp;
    document.getElementById('xf').style.width     = Math.min(100,Math.round(xpIn/xpN*100))+'%';
    document.getElementById('xpnext').textContent = `${xpIn}/${xpN} XP → LVL ${next.l}`;
  } else {
    document.getElementById('xf').style.width     = '100%';
    document.getElementById('xpnext').textContent = 'MAX LEVEL ★';
  }

  // Task list
  const curIdx = findCurIdx(nm);
  let html = '';
  SCHED.forEach((task, i) => {
    const s      = dy.tasks[task.id] || 'pending';
    const moods  = dy.moods[task.id] || {};
    const isNow  = i === curIdx;
    let cls='', bc='bup', bt='QUEUED';
    if      (s==='complete') { cls='tdone'; bc='bdone'; bt='✓ DONE'; }
    else if (s==='failed')   { cls='tfail'; bc='bfail'; bt='✗ FAIL'; }
    else if (isNow)          { cls='tnow';  bc='bnow';  bt='NOW';    }

    const xpL = s==='complete' ? `+${task.xp} XP ✓` : `${task.xp} XP`;

    let btn = '';
    if      (s==='pending')  btn = `<button class="tbtn bcomp" onclick="window.markDone('${task.id}')">DONE ✓</button>`;
    else if (s==='complete') btn = `<button class="tbtn bundo" onclick="window.markUndo('${task.id}')">UNDO</button>`;
    else if (s==='failed')   btn = `<button class="tbtn bredo" onclick="window.markDone('${task.id}')">REDO ✓</button>`;

    // Mood row — show before picker for current task, after picker on complete, display if set
    let moodRow = '';
    if (isNow && s==='pending') {
      moodRow = `<div class="mood-row">${moodPickerHtml(task.id,'before', moods.before||null)}</div>`;
    } else if (s==='complete') {
      const beforePart = moods.before ? moodPickerHtml(task.id,'before',moods.before) : '';
      const afterPart  = moodPickerHtml(task.id,'after', moods.after||null);
      if (beforePart || !moods.after)
        moodRow = `<div class="mood-row">${beforePart}${afterPart}</div>`;
    }

    html += `
      <div class="ti ${cls}" id="ti-${task.id}">
        <div class="tmain">
          <div class="ttc">
            <div class="ttime">${fmt12(task.time)}</div>
            <div class="temoji">${task.emoji}</div>
          </div>
          <div class="tbody">
            <div class="tlbl">${task.label}</div>
            <div class="txp">${xpL}</div>
          </div>
          <div class="tright">
            <span class="badge ${bc}">${bt}</span>
            ${btn}
          </div>
        </div>
        ${moodRow}
      </div>`;
  });
  document.getElementById('tl').innerHTML = html;

  // Fun acts
  let funHtml = '';
  FUN_ACTS.forEach(act => {
    const count = dy.funActs?.[act.id] || 0;
    const xpTxt = act.xp > 0 ? `+${act.xp} XP` : `${act.xp} XP`;
    const cls   = act.xp < 0 ? 'fa-bad' : 'fa-good';
    funHtml += `<div class="fa-item ${cls}" onclick="window.logFunAct('${act.id}')">
      <div class="fa-emoji">${act.emoji}</div>
      <div class="fa-label">${act.label}</div>
      <div class="fa-xp">${xpTxt}</div>
      ${count>0 ? `<div class="fa-count">×${count}</div>` : ''}
    </div>`;
  });
  document.getElementById('fun-acts').innerHTML = funHtml;

  renderInsights();
  renderWeekChart();
  renderStatsDashboard();
}

// ── Pattern detection render ────────────────────────────────────
export function renderInsights() {
  const el = document.getElementById('insights');
  if (!el) return;

  const analysis = analyzePatterns(state.data);

  if (!analysis.ready) {
    el.innerHTML = `<div class="insight-empty">📊 Complete at least 3 days to unlock pattern analysis. Your data is being collected.</div>`;
    return;
  }
  if (analysis.insights.length === 0) {
    el.innerHTML = `<div class="insight-empty">✅ No negative patterns detected yet. Keep going — the data is building.</div>`;
    return;
  }

  const typeStyle = { danger:'ins-danger', warn:'ins-warn', pattern:'ins-pattern', mood:'ins-mood', win:'ins-win' };
  el.innerHTML = analysis.insights.map(ins => `
    <div class="insight-card ${typeStyle[ins.type]||'ins-warn'}">
      <span class="ins-icon">${ins.emoji}</span>
      <span class="ins-msg">${ins.msg}</span>
    </div>`).join('');
}

// ── Weekly chart ────────────────────────────────────────────────
export function renderWeekChart() {
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const today = new Date(); const dow = today.getDay();
  let html = '';
  for (let i=0; i<7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + (i - (dow===0?6:dow-1)));
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isToday = k===state.todayStr, isFuture = d>today&&!isToday;
    let pct = 0;
    if (!isFuture && state.data.days?.[k]) {
      const tasks = state.data.days[k].tasks || state.data.days[k];
      const done  = SCHED.filter(t=>tasks[t.id]==='complete').length;
      pct = Math.round(done/SCHED.length*100);
    }
    const barH = Math.max(4, pct*0.56);
    html += `<div class="wbar-wrap${isToday?' today':''}">
      <div class="wbar" style="height:56px"><div class="wbar-fill" style="height:${barH}px"></div></div>
      <div class="wbar-day">${days[i]}</div>
    </div>`;
  }
  document.getElementById('week-chart').innerHTML = html;
}

// ── Full stats dashboard ────────────────────────────────────────
export function renderStatsDashboard() {
  const data = state.data || load();
  const stats = buildStats(data);

  const overview = document.getElementById('stats-overview');
  if (overview) {
    overview.innerHTML = [
      statCard('AVG RATE', `${stats.avgRate}%`, `${stats.activeDays} logged day${stats.activeDays===1?'':'s'}`),
      statCard('BEST DAY', stats.bestDow.label, `${stats.bestDow.rate}% average`),
      statCard('WORST DAY', stats.worstDow.label, `${stats.worstDow.rate}% average`),
      statCard('HOURS LOGGED', `${stats.totalHours}h`, `${stats.completedBlocks} completed blocks`),
    ].join('');
  }

  renderHeatmap(stats);
  renderXpGraph(stats);
  renderTypeRates(stats);
  renderTaskRates(stats);
}

function buildStats(data) {
  const dayEntries = Object.entries(data.days || {})
    .sort(([a], [b]) => parseDayKey(a) - parseDayKey(b));
  const activeEntries = dayEntries.filter(([, day]) => isActiveDay(day));
  const activeDayCount = activeEntries.length;

  const taskStats = {};
  const typeStats = {};
  const dowStats = Array(7).fill(null).map((_, i) => ({ label:DOW_LABEL[i], totalPct:0, days:0, rate:0 }));
  let totalDone = 0, totalPossible = activeDayCount * SCHED.length;
  let totalMinutes = 0, completedBlocks = 0;

  SCHED.forEach(task => {
    taskStats[task.id] = {
      task,
      type: taskType(task),
      total: activeDayCount,
      completed: 0,
      currentRun: 0,
      bestStreak: 0,
    };
  });

  activeEntries.forEach(([key, day]) => {
    const tasks = day.tasks || day;
    const done = SCHED.filter(task => tasks[task.id] === 'complete').length;
    totalDone += done;
    const pct = Math.round(done / SCHED.length * 100);
    const dow = parseDayKey(key).getDay();
    dowStats[dow].totalPct += pct;
    dowStats[dow].days++;

    SCHED.forEach((task, i) => {
      const st = taskStats[task.id];
      const type = st.type;
      if (!typeStats[type]) typeStats[type] = { label:type, total:0, completed:0 };
      typeStats[type].total++;

      if (tasks[task.id] === 'complete') {
        st.completed++;
        st.currentRun++;
        st.bestStreak = Math.max(st.bestStreak, st.currentRun);
        typeStats[type].completed++;
        completedBlocks++;
        totalMinutes += taskDuration(i);
      } else {
        st.currentRun = 0;
      }
    });
  });

  dowStats.forEach(s => { s.rate = s.days ? Math.round(s.totalPct / s.days) : 0; });
  const usedDows = dowStats.filter(s => s.days > 0);
  const bestDow = usedDows.length ? usedDows.reduce((a,b) => b.rate > a.rate ? b : a) : { label:'—', rate:0 };
  const worstDow = usedDows.length ? usedDows.reduce((a,b) => b.rate < a.rate ? b : a) : { label:'—', rate:0 };

  const xpHistory = activeEntries.map(([key, day]) => ({ key, xp: estimateDayXp(day) }));
  let runningXp = 0;
  xpHistory.forEach(d => { runningXp = Math.max(0, runningXp + d.xp); d.total = runningXp; });

  return {
    activeDays: activeDayCount,
    avgRate: totalPossible ? Math.round(totalDone / totalPossible * 100) : 0,
    bestDow,
    worstDow,
    totalHours: (totalMinutes / 60).toFixed(1),
    completedBlocks,
    taskStats: Object.values(taskStats).map(s => ({
      ...s,
      rate: s.total ? Math.round(s.completed / s.total * 100) : 0,
    })),
    typeStats: Object.values(typeStats).map(s => ({
      ...s,
      rate: s.total ? Math.round(s.completed / s.total * 100) : 0,
    })).sort((a,b) => b.rate - a.rate),
    xpHistory,
  };
}

function renderHeatmap(stats) {
  const el = document.getElementById('heatmap');
  if (!el) return;
  const today = new Date();
  const cells = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dateKey(d);
    const day = state.data.days?.[key];
    const pct = dayCompletionPct(day);
    const active = day && isActiveDay(day);
    const done = day ? SCHED.filter(task => (day.tasks || day)[task.id] === 'complete').length : 0;
    const cls = !active ? 'h0' : pct >= 85 ? 'h4' : pct >= 55 ? 'h3' : pct > 0 ? 'h2' : 'h1';
    cells.push(`<div class="heat-cell ${cls}" title="${key}: ${active ? pct+'% ('+done+'/'+SCHED.length+')' : 'no logged tasks'}"></div>`);
  }
  el.innerHTML = cells.join('');
}

function renderXpGraph(stats) {
  const el = document.getElementById('xp-graph');
  if (!el) return;
  const rows = stats.xpHistory.slice(-21);
  if (!rows.length) {
    el.innerHTML = '<div class="xp-empty">No XP history yet. Complete tasks to build the graph.</div>';
    return;
  }
  const max = Math.max(...rows.map(r => r.total), 1);
  el.innerHTML = `<div class="xp-graph">${rows.map(r => {
    const h = Math.max(4, Math.round(r.total / max * 88));
    return `<div class="xp-bar${r.key===state.todayStr?' today':''}" style="height:${h}px" title="${r.key}: ${r.total} XP total, ${r.xp >= 0 ? '+' : ''}${r.xp} XP day"></div>`;
  }).join('')}</div>`;
}

function renderTypeRates(stats) {
  const el = document.getElementById('type-rates');
  if (!el) return;
  if (!stats.typeStats.length) {
    el.innerHTML = '<div class="xp-empty">No task type data yet.</div>';
    return;
  }
  el.innerHTML = stats.typeStats.map(s => rateRow(s.label, s.rate, `${s.completed}/${s.total} completed`)).join('');
}

function renderTaskRates(stats) {
  const el = document.getElementById('task-rates');
  if (!el) return;
  if (!stats.activeDays) {
    el.innerHTML = '<div class="xp-empty">No task history yet. Finish a few days and this gets interesting.</div>';
    return;
  }
  el.innerHTML = stats.taskStats
    .sort((a,b) => a.rate - b.rate || b.task.xp - a.task.xp)
    .map(s => rateRow(`${s.task.emoji} ${s.task.label}`, s.rate, `${s.completed}/${s.total} days · best streak ${s.bestStreak}`))
    .join('');
}

function statCard(k, v, s) {
  return `<div class="stat-card"><div class="stat-k">${k}</div><div class="stat-v">${v}</div><div class="stat-s">${s}</div></div>`;
}

function rateRow(label, rate, sub) {
  return `<div class="rate-row">
    <div>
      <div class="rate-top"><span>${label}</span></div>
      <div class="mini-track"><div class="mini-fill" style="width:${rate}%"></div></div>
      <div class="rate-sub">${sub}</div>
    </div>
    <div class="rate-pct">${rate}%</div>
  </div>`;
}

function isActiveDay(day) {
  if (!day) return false;
  const tasks = day.tasks || day;
  return SCHED.some(task => tasks[task.id] === 'complete' || tasks[task.id] === 'failed');
}

function dayCompletionPct(day) {
  if (!day || !isActiveDay(day)) return 0;
  const tasks = day.tasks || day;
  const done = SCHED.filter(task => tasks[task.id] === 'complete').length;
  return Math.round(done / SCHED.length * 100);
}

function taskDuration(i) {
  const cur = parseHM(SCHED[i].time);
  const next = i < SCHED.length - 1 ? parseHM(SCHED[i+1].time) : cur + 30;
  return Math.max(0, next - cur);
}

function taskType(task) {
  const label = task.label.toLowerCase();
  if (/dsa|leetcode/.test(label)) return 'DSA';
  if (/web development/.test(label)) return 'Web Dev';
  if (/project/.test(label)) return 'Projects';
  if (/english|typing/.test(label)) return 'English';
  if (/creative|editing|pixel/.test(label)) return 'Creative';
  if (/revision|coding/.test(label)) return 'Revision';
  if (/exercise|walk|stretch|breakfast|lunch|dinner|sleep|screens|lights/.test(label)) return 'Health';
  if (/planning|evaluation/.test(label)) return 'Planning';
  return 'Recovery';
}

function estimateDayXp(day) {
  const tasks = day.tasks || day;
  const awards = day.xpAwards || {};
  let xp = 0;
  SCHED.forEach(task => {
    if (tasks[task.id] === 'complete') xp += awards[task.id] ?? task.xp;
    if (tasks[task.id] === 'failed' && task.penalty) xp -= 25;
  });
  FUN_ACTS.forEach(act => { xp += (day.funActs?.[act.id] || 0) * act.xp; });
  if (day.rewards?.allComplete || SCHED.every(task => tasks[task.id] === 'complete')) xp += 300;
  if (day.rewards?.debrief) xp += 35;
  return xp;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Clock ───────────────────────────────────────────────────────
export function updClock() {
  const n = new Date();
  document.getElementById('clk').textContent =
    `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
  const DAYS=['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  document.getElementById('clk-date').textContent =
    `${DAYS[n.getDay()]} ${MONTHS[n.getMonth()]} ${n.getDate()}, ${n.getFullYear()}`;
  document.getElementById('dbadge').textContent = `${n.getDate()} ${MONTHS[n.getMonth()]}`;
  const nm = nowM();
  let nxt = null;
  for (const t of SCHED) { if (parseHM(t.time)>nm) { nxt=t; break; } }
  if (nxt) {
    document.getElementById('cn-val').textContent = `${nxt.emoji} ${nxt.label} @ ${fmt12(nxt.time)}`;
    const s  = Math.max(0, Math.floor(msUntil(nxt.time)/1000));
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sc=s%60;
    document.getElementById('countdown').textContent = `T-${h>0?h+'h ':''}${m}m ${sc}s`;
  } else {
    document.getElementById('cn-val').textContent  = 'All done today ✓';
    document.getElementById('countdown').textContent = 'MISSION COMPLETE ✓';
  }
}

// ── Helpers ─────────────────────────────────────────────────────
export function flashT(id, type) {
  const el = document.getElementById('ti-'+id); if (!el) return;
  el.classList.remove('fgreen','fred'); void el.offsetWidth;
  el.classList.add(type==='g'?'fgreen':'fred');
  setTimeout(()=>el.classList.remove('fgreen','fred'), 750);
}

export function xpFloat(val, el) {
  const d = document.createElement('div');
  d.className = 'xpf '+(val>0?'gn':'ls');
  d.textContent = (val>0?'+':'')+val+' XP';
  if (el) {
    const r=el.getBoundingClientRect();
    d.style.left=(r.left+r.width/2)+'px'; d.style.top=(r.top+window.scrollY)+'px';
  } else { d.style.left='50%'; d.style.top='40%'; }
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 1600);
}
