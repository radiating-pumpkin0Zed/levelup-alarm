// ── All static data constants ──

export const SCHED = [
  { id:'0700', time:'07:00', emoji:'🔴', label:'Wake Up',                     xp:30,  alarm:'GET UP. Right now. Not in 5 minutes. NOW.', penalty:'You ignored wake-up. Every success story started with getting out of bed.' },
  { id:'0715', time:'07:15', emoji:'🏃', label:'Exercise / Walk / Stretch',   xp:40,  alarm:'15 minutes. Move your body. You cannot think inside a stiff corpse.', penalty:'Skipped exercise. Your brain runs on blood flow. You just starved it.' },
  { id:'0745', time:'07:45', emoji:'🍳', label:'Breakfast + Daily Planning',  xp:25,  alarm:'Eat real food. Write ONE goal for today — not a list. One.', penalty:'No plan = no direction. You are a ship with no rudder.' },
  { id:'0815', time:'08:15', emoji:'🧠', label:'DSA / LeetCode [1.5 hr]',     xp:80,  alarm:'DEEP WORK. Phone face-down. Arrays, strings, hashing.', penalty:'DSA MISSED. The gap between you and your goals just got wider.' },
  { id:'1000', time:'10:00', emoji:'☕', label:'Break [30 min]',               xp:15,  alarm:'Earned break. Do NOT open Instagram. 30 mins.', penalty:'' },
  { id:'1030', time:'10:30', emoji:'💻', label:'Web Development [2.5 hr]',    xp:90,  alarm:'Editor open. Tutorial must produce something REAL. Build, do not watch.', penalty:'WEB DEV MISSED. Watching tutorials without coding = collecting recipes without cooking.' },
  { id:'1300', time:'13:00', emoji:'🍱', label:'Lunch + Rest [1 hr]',         xp:15,  alarm:'Eat properly. Rest your eyes. No doom-scrolling.', penalty:'' },
  { id:'1400', time:'14:00', emoji:'⌨️', label:'English + Typing Practice',   xp:40,  alarm:'Monkeytype. Think in English. 3 new words. Go.', penalty:'Typing/English skipped. Fluency is built in boring daily reps. You skipped one.' },
  { id:'1500', time:'15:00', emoji:'🎨', label:'Creative Skill [Editing/Pixel]',xp:45,alarm:'ONE skill. Make one thing today. Tiny is fine. Make it real.', penalty:'Creative session MISSED. Zero output is the only true failure.' },
  { id:'1600', time:'16:00', emoji:'🌤️', label:'Free Time',                   xp:10,  alarm:'Decompress. Rest. You earned 1 hour. No guilt.', penalty:'' },
  { id:'1700', time:'17:00', emoji:'⚒️', label:'Project Building [2 hr]',     xp:100, alarm:'BUILD TIME. Actual code. Actual commits. Push to GitHub.', penalty:'PROJECT MISSED. A portfolio with zero projects is just a blank page.' },
  { id:'1900', time:'19:00', emoji:'🍜', label:'Dinner + Rest',               xp:10,  alarm:'Eat. Rest your eyes. Come back stronger.', penalty:'' },
  { id:'2000', time:'20:00', emoji:'📖', label:'Revision / Light Coding [1.5 hr]',xp:50,alarm:'Review today\'s work. Fix one bug. Reinforce one concept.',penalty:'Evening revision SKIPPED. Forgetting curve is real. You just lost retention.' },
  { id:'2130', time:'21:30', emoji:'😮‍💨',label:'Chill Time',                  xp:10,  alarm:'Wind down. Anime, music, walk. You earned this.', penalty:'' },
  { id:'2230', time:'22:30', emoji:'📋', label:'Daily Evaluation',            xp:35,  alarm:'Write: What I completed. What distracted me. What improved.', penalty:'No review = same mistakes tomorrow. 5 minutes. That is all.' },
  { id:'2300', time:'23:00', emoji:'🌙', label:'Screens Off — Sleep Prep',    xp:20,  alarm:'Phone down. Laptop closed. Brain needs to wind down.', penalty:'Screen time not cut. Blue light destroys sleep quality.' },
  { id:'2330', time:'23:30', emoji:'💤', label:'LIGHTS OUT',                  xp:25,  alarm:'Close your eyes. Sleep is recovery. NOW.', penalty:'Still awake past 11:30. Tomorrow\'s 7AM will feel like punishment.' },
];

export const LEVELS = [
  { l:1, n:'ROOKIE',    xp:0     },
  { l:2, n:'INITIATE',  xp:200   },
  { l:3, n:'BUILDER',   xp:500   },
  { l:4, n:'GRINDER',   xp:1000  },
  { l:5, n:'CODER',     xp:2000  },
  { l:6, n:'DEVELOPER', xp:3500  },
  { l:7, n:'VETERAN',   xp:5500  },
  { l:8, n:'MASTER',    xp:8000  },
  { l:9, n:'LEGEND',    xp:11000 },
];

export const QUOTES = [
  ['Tiny boring consistency changes lives.',                                   '— Your 2-Month Plan'],
  ['You want to build. That is valuable.',                                     '— Your 2-Month Plan'],
  ['Minimum progress > zero progress.',                                        '— Mission Control'],
  ['You do not need to become extraordinary in 2 months. You need proof.',     '— The Plan'],
  ['A clean Notion dashboard won\'t save your future if nothing gets built.',  '— Hard Truth'],
  ['Not emotionally. Mechanically. Tiny progress daily. That is the game.',   '— The Plan'],
  ['5 focused hours daily beats motivational chaos.',                          '— Schedule Protocol'],
  ['Build things. Not just watch tutorials while becoming furniture.',         '— Web Dev Rule'],
  ['Deploy projects. Actually finish things. A rare event in civilization.',   '— Week 7-8'],
  ['Your problem is not lack of ambition. It is fragmentation.',              '— The Plan'],
  ['One portfolio. Two or three projects. That is already a massive win.',    '— Minimum Outcome'],
  ['You can stay consistent. You can finish projects. Trust yourself again.', '— Mission Statement'],
];

// Side quests — fun activities with low XP (or negative for bad habits)
export const FUN_ACTS = [
  { id:'anime',       label:'Watched Anime',       emoji:'📺', xp:5,   positive:true  },
  { id:'gaming',      label:'Played Games',         emoji:'🎮', xp:3,   positive:true  },
  { id:'walk',        label:'Took a Walk',          emoji:'🚶', xp:10,  positive:true  },
  { id:'cook',        label:'Cooked a Meal',        emoji:'🍳', xp:8,   positive:true  },
  { id:'friends',     label:'Hung Out w/ Friends',  emoji:'👥', xp:7,   positive:true  },
  { id:'read',        label:'Read Fiction',         emoji:'📚', xp:8,   positive:true  },
  { id:'movie',       label:'Watched a Movie',      emoji:'🎬', xp:5,   positive:true  },
  { id:'nap',         label:'Took a Nap',           emoji:'😴', xp:5,   positive:true  },
  { id:'music',       label:'Made/Played Music',    emoji:'🎵', xp:6,   positive:true  },
  { id:'doomscroll',  label:'Doom-Scrolled 30min',  emoji:'📱', xp:-5,  positive:false },
  { id:'junk',        label:'Ate Junk Food',        emoji:'🍔', xp:-3,  positive:false },
  { id:'latebedtime', label:'Slept Past Midnight',  emoji:'🌑', xp:-8,  positive:false },
];