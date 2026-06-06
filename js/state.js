// ── Shared mutable state across all modules ──
export const state = {
  data: {},
  todayStr: '',
  notifOn: false,
  soundOn: false,
  penaltyOn: true,
  alarmOn: true,
  wakeLock: null,
  currentBg: 'anime',
  taskDetailId: null,
  handles: [],       // setTimeout handles for alarms
  audioCtx: null,
};
