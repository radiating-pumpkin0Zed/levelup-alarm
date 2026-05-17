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
  handles: [],       // setTimeout handles for alarms
  audioCtx: null,
};
