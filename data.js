// ============== STATIC GAME DATA ==============

const PILOTS = [
  {
    id: 'wraith', name: 'Wraith', icon: '🛸', tag: 'Balanced Drifter',
    speed: 1.0, hitbox: 1.0, magnet: 1.0,
    ability: 'Standard handling. The reliable choice for new Runners.',
    cost: 0, unlocked: true
  },
  {
    id: 'comet', name: 'Comet', icon: '🚀', tag: 'Speed Specialist',
    speed: 1.3, hitbox: 1.1, magnet: 0.9,
    ability: 'Boost charges 30% faster, but the hitbox runs a little wide.',
    cost: 800, unlocked: false
  },
  {
    id: 'shade', name: 'Shade', icon: '👻', tag: 'Precision Hull',
    speed: 0.9, hitbox: 0.75, magnet: 1.0,
    ability: 'Tiny collision box — thread gaps other pilots can\'t.',
    cost: 1500, unlocked: false
  },
  {
    id: 'magnos', name: 'Magnos', icon: '🧲', tag: 'Collector',
    speed: 0.95, hitbox: 1.0, magnet: 1.6,
    ability: 'Shard and gem pull radius is massively extended.',
    cost: 2200, unlocked: false
  },
  {
    id: 'pulsar', name: 'Pulsar', icon: '⚡', tag: 'Glass Cannon',
    speed: 1.45, hitbox: 1.25, magnet: 1.0,
    ability: 'Fastest ship in Sector 7. One hit and you\'re done — no extra hull.',
    cost: 3500, unlocked: false
  },
  {
    id: 'voidking', name: 'Voidling', icon: '👁️', tag: 'Legendary',
    speed: 1.2, hitbox: 0.9, magnet: 1.3,
    ability: 'A creature born from the Rift itself. All-round elite stats.',
    cost: 6000, unlocked: false
  }
];

const SHOP_ITEMS = {
  skins: [
    { id: 'skin_chrome', name: 'Chrome Hull', icon: '⬜', desc: 'Reflective plating, pure white trail.', price: 400, color:'#e8e8f0' },
    { id: 'skin_magenta', name: 'Magenta Drift', icon: '🟪', desc: 'High-visibility pink hull wrap.', price: 600, color:'#ff2d95' },
    { id: 'skin_gold', name: 'Gold Plate', icon: '🟨', desc: 'Flex on the leaderboard.', price: 1200, color:'#ffd23f' },
    { id: 'skin_void', name: 'Void Black', icon: '⬛', desc: 'Nearly invisible against the tunnel.', price: 1800, color:'#1a1a2e' },
  ],
  boosts: [
    { id: 'boost_shield', name: 'Starter Shield', icon: '🛡️', desc: 'Begin every run with 1 free hit absorbed.', price: 350 },
    { id: 'boost_magnet', name: 'Magnet Pulse', icon: '🧲', desc: 'Permanently +20% collectible pull radius.', price: 700 },
    { id: 'boost_slowmo', name: 'Slow-Mo Charge', icon: '⏱️', desc: 'Press Shift mid-run to slow the tunnel for 3s (1 use/run).', price: 950 },
    { id: 'boost_revive', name: 'Phase Revive', icon: '💫', desc: 'Survive one fatal hit per run automatically.', price: 2000 },
  ],
  trails: [
    { id: 'trail_spark', name: 'Spark Trail', icon: '✨', desc: 'Trailing embers behind your ship.', price: 300 },
    { id: 'trail_rainbow', name: 'Prism Trail', icon: '🌈', desc: 'Shifting rainbow drift trail.', price: 850 },
    { id: 'trail_comet', name: 'Comet Tail', icon: '☄️', desc: 'Long blazing tail effect.', price: 1100 },
  ]
};

const ACHIEVEMENTS = [
  { id: 'first_run', name: 'First Drop', desc: 'Complete your first run', icon: '🎮', check: s => s.totalRuns >= 1 },
  { id: 'score_1000', name: 'Four Digits', desc: 'Score 1,000+ in one run', icon: '🔢', check: s => s.bestScore >= 1000 },
  { id: 'score_5000', name: 'Veteran Runner', desc: 'Score 5,000+ in one run', icon: '🏆', check: s => s.bestScore >= 5000 },
  { id: 'shards_1000', name: 'Shard Hoarder', desc: 'Collect 1,000 total shards', icon: '💎', check: s => s.totalShardsEarned >= 1000 },
  { id: 'shards_10000', name: 'Crystal Baron', desc: 'Collect 10,000 total shards', icon: '👑', check: s => s.totalShardsEarned >= 10000 },
  { id: 'depth_10', name: 'Deep Diver', desc: 'Reach depth 10 in a run', icon: '🕳️', check: s => s.bestDepth >= 10 },
  { id: 'runs_10', name: 'Regular', desc: 'Complete 10 runs', icon: '📋', check: s => s.totalRuns >= 10 },
  { id: 'runs_50', name: 'Addicted', desc: 'Complete 50 runs', icon: '🔥', check: s => s.totalRuns >= 50 },
  { id: 'all_pilots', name: 'Full Roster', desc: 'Unlock every pilot', icon: '🛸', check: s => s.unlockedPilots.length >= PILOTS.length },
  { id: 'egg_found', name: 'Rift Echo', desc: 'Find the hidden easter egg', icon: '◈', check: s => s.eggFound },
];

const DAILY_MISSIONS = [
  { id: 'm_score', label: 'Score 800+ in a single run', target: 800, type: 'score', reward: 150 },
  { id: 'm_shards', label: 'Collect 300 shards today', target: 300, type: 'dailyShards', reward: 200 },
  { id: 'm_runs', label: 'Complete 3 runs', target: 3, type: 'dailyRuns', reward: 100 },
];

const BOT_LEADERBOARD = [
  { name: 'Zephyrix', score: 14820, depth: 22, pilot: 'Voidling' },
  { name: 'Korr_9', score: 12990, depth: 19, pilot: 'Pulsar' },
  { name: 'NullVector', score: 11400, depth: 18, pilot: 'Magnos' },
  { name: 'AshDrift', score: 9870, depth: 15, pilot: 'Shade' },
  { name: 'Quasarine', score: 8650, depth: 14, pilot: 'Comet' },
  { name: 'Riftborne', score: 7320, depth: 12, pilot: 'Wraith' },
  { name: 'NovaTrace', score: 6010, depth: 11, pilot: 'Comet' },
  { name: 'Glimmer_X', score: 4980, depth: 9, pilot: 'Shade' },
];

// ============== STATE MANAGEMENT ==============

const SAVE_KEY = 'voidrunner_save_v1';

function defaultState(){
  return {
    username: 'Runner',
    avatar: '🛸',
    signedIn: false,
    shards: 200,
    selectedPilot: 'wraith',
    unlockedPilots: ['wraith'],
    ownedItems: [],
    bestScore: 0,
    bestDepth: 0,
    totalRuns: 0,
    totalShardsEarned: 0,
    totalTimePlayed: 0, // seconds
    eggFound: false,
    unlockedAchievements: [],
    history: [], // {date, score, depth, shards, result}
    dailyDate: null,
    dailyProgress: { dailyShards: 0, dailyRuns: 0, bestScoreToday: 0 },
    claimedMissions: [],
    settings: {
      musicVol: 60, sfxVol: 80, muted: false,
      difficulty: 'normal', theme: 'cyan'
    }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge with defaults to survive schema changes
    return Object.assign(defaultState(), parsed, {
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
      dailyProgress: Object.assign(defaultState().dailyProgress, parsed.dailyProgress || {})
    });
  }catch(e){
    console.warn('Save corrupted, resetting.', e);
    return defaultState();
  }
}

function saveState(state){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }catch(e){
    console.warn('Could not save', e);
  }
}

function todayStr(){
  return new Date().toISOString().slice(0,10);
}

function ensureDailyReset(state){
  const t = todayStr();
  if(state.dailyDate !== t){
    state.dailyDate = t;
    state.dailyProgress = { dailyShards: 0, dailyRuns: 0, bestScoreToday: 0 };
    state.claimedMissions = [];
  }
}
