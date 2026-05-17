// ── localStorage helpers ──
import { SCHED } from './data.js';

const SK = 'lu_v3';

export function load() {
  try {
    const r = localStorage.getItem(SK);
    if (r) return JSON.parse(r);
  } catch (e) {}
  return {
    days: {},
    stats: { streak:0, bestStreak:0, totalXP:0, lastDate:null },
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
    d.days[k] = { tasks:{}, funActs:{} };
    SCHED.forEach(t => { d.days[k].tasks[t.id] = 'pending'; });
  }
  // Migrate old format (tasks were at root of day object)
  if (!d.days[k].tasks) {
    const tasks = {};
    SCHED.forEach(t => { tasks[t.id] = d.days[k][t.id] || 'pending'; });
    d.days[k] = { tasks, funActs: d.days[k].funActs || {} };
  }
  if (!d.days[k].funActs) d.days[k].funActs = {};
  return d.days[k];
}
