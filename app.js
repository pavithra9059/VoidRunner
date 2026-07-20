// ============== APP CONTROLLER ==============

let STATE = loadState();
ensureDailyReset(STATE);
saveState(STATE);

function getPilot(id){ return PILOTS.find(p => p.id === id) || PILOTS[0]; }
function isPilotUnlocked(id){ return STATE.unlockedPilots.indexOf(id) !== -1; }
function isItemOwned(id){ return STATE.ownedItems.indexOf(id) !== -1; }

function pilotRuntimeConfig(pilot){
  return {
    speed: pilot.speed, hitbox: pilot.hitbox, magnet: pilot.magnet * (isItemOwned('boost_magnet') ? 1.2 : 1),
    color: shipColorFromSkin(),
    startShield: isItemOwned('boost_shield'),
    hasSlowmo: isItemOwned('boost_slowmo'),
    hasRevive: isItemOwned('boost_revive')
  };
}
function shipColorFromSkin(){
  const skins = SHOP_ITEMS.skins;
  for(const s of skins){ if(isItemOwned(s.id)) return s.color; }
  return '#7df9ff';
}

// ---------- TOASTS ----------
function toast(msg, type){
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' '+type : '');
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .4s'; setTimeout(()=>el.remove(),400); }, 3200);
}

// ---------- NAVIGATION ----------
function navigate(screenId){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screenId);
  if(target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(b => {
    b.classList.toggle('active', b.dataset.nav === screenId);
  });
  document.getElementById('mobile-menu').classList.remove('open');
  window.scrollTo({top:0, behavior:'smooth'});

  if(screenId === 'home') renderHome();
  if(screenId === 'play') renderPlayEntry();
  if(screenId === 'characters') renderCharacters();
  if(screenId === 'shop') renderShop();
  if(screenId === 'leaderboard') renderLeaderboard();
  if(screenId === 'profile') renderProfile();
  if(screenId === 'settings') renderSettings();

  checkEasterEggTrigger(screenId);
}

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.nav));
});
document.getElementById('nav-burger').addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('open');
});

// ---------- NAV CURRENCY / AUTH ----------
function refreshNavCurrency(){
  document.getElementById('nav-shards').textContent = STATE.shards.toLocaleString();
  const btn = document.getElementById('nav-auth-btn');
  btn.textContent = STATE.signedIn ? STATE.username : 'Sign In';
}

document.getElementById('nav-auth-btn').addEventListener('click', () => {
  if(STATE.signedIn){ navigate('profile'); return; }
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('auth-username').value = STATE.username === 'Runner' ? '' : STATE.username;
});
document.getElementById('auth-close').addEventListener('click', () => {
  document.getElementById('auth-modal').classList.add('hidden');
});
document.getElementById('auth-submit').addEventListener('click', () => {
  const name = document.getElementById('auth-username').value.trim();
  STATE.username = name || 'Runner' + Math.floor(Math.random()*9000+1000);
  STATE.signedIn = true;
  saveState(STATE);
  refreshNavCurrency();
  document.getElementById('auth-modal').classList.add('hidden');
  toast('Welcome back, ' + STATE.username + '.');
});

// ---------- HOME SCREEN ----------
function renderHome(){
  document.getElementById('home-stat-best').textContent = STATE.bestScore.toLocaleString();
  document.getElementById('home-stat-runs').textContent = STATE.totalRuns;
  const rank = computeMyRank();
  document.getElementById('home-stat-rank').textContent = rank ? '#'+rank : '—';

  const cardsEl = document.getElementById('home-pilot-cards');
  cardsEl.innerHTML = '';
  PILOTS.slice(0,3).forEach(p => {
    const div = document.createElement('div');
    div.className = 'glass-card pilot-card';
    div.dataset.nav = 'characters';
    div.innerHTML = `
      <span class="p-icon">${p.icon}</span>
      <h3>${p.name}</h3>
      <p>${p.ability}</p>
    `;
    div.addEventListener('click', () => navigate('characters'));
    cardsEl.appendChild(div);
  });

  const missionsEl = document.getElementById('home-missions');
  missionsEl.innerHTML = '';
  DAILY_MISSIONS.forEach(m => {
    const progress = m.type === 'score' ? STATE.dailyProgress.bestScoreToday : STATE.dailyProgress[m.type];
    const pct = Math.min(100, Math.round((progress/m.target)*100));
    const claimed = STATE.claimedMissions.indexOf(m.id) !== -1;
    const div = document.createElement('div');
    div.className = 'glass-card mission-card';
    div.innerHTML = `
      <h4>${m.label}</h4>
      <p>${progress}/${m.target}${claimed ? ' ✓ Claimed' : ''}</p>
      <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
      <div class="mission-reward">+${m.reward} ◆ shards</div>
    `;
    missionsEl.appendChild(div);
  });
}

function computeMyRank(){
  if(STATE.bestScore <= 0) return null;
  const all = BOT_LEADERBOARD.map(b => b.score).concat([STATE.bestScore]).sort((a,b)=>b-a);
  return all.indexOf(STATE.bestScore) + 1;
}

// ---------- MISSION CHECKING ----------
function checkMissionsAfterRun(result){
  ensureDailyReset(STATE);
  STATE.dailyProgress.dailyRuns += 1;
  STATE.dailyProgress.dailyShards += result.dailyShardsThisRun;
  STATE.dailyProgress.bestScoreToday = Math.max(STATE.dailyProgress.bestScoreToday, result.score);

  DAILY_MISSIONS.forEach(m => {
    if(STATE.claimedMissions.indexOf(m.id) !== -1) return;
    const progress = m.type === 'score' ? STATE.dailyProgress.bestScoreToday : STATE.dailyProgress[m.type];
    if(progress >= m.target){
      STATE.claimedMissions.push(m.id);
      STATE.shards += m.reward;
      toast('Contract complete: ' + m.label + ' (+'+m.reward+' shards)', 'gold');
    }
  });
}

// ---------- ACHIEVEMENTS ----------
function checkAchievements(){
  const statSnapshot = {
    totalRuns: STATE.totalRuns, bestScore: STATE.bestScore, totalShardsEarned: STATE.totalShardsEarned,
    bestDepth: STATE.bestDepth, unlockedPilots: STATE.unlockedPilots, eggFound: STATE.eggFound
  };
  ACHIEVEMENTS.forEach(a => {
    if(STATE.unlockedAchievements.indexOf(a.id) === -1 && a.check(statSnapshot)){
      STATE.unlockedAchievements.push(a.id);
      toast('🏆 Achievement unlocked: ' + a.name, 'gold');
    }
  });
}

// ---------- PLAY SCREEN ----------
let canvasInited = false;
let selectedRunPilot = STATE.selectedPilot;

function renderPlayEntry(){
  document.getElementById('overlay-start').classList.remove('hidden');
  document.getElementById('overlay-pause').classList.add('hidden');
  document.getElementById('overlay-gameover').classList.add('hidden');

  if(!canvasInited){
    Game.init(document.getElementById('game-canvas'));
    Game.setVolumes(STATE.settings.musicVol, STATE.settings.sfxVol, STATE.settings.muted);
    canvasInited = true;
  }

  const row = document.getElementById('play-pilot-row');
  row.innerHTML = '';
  PILOTS.forEach(p => {
    const unlocked = isPilotUnlocked(p.id);
    const btn = document.createElement('button');
    btn.className = 'pilot-pick' + (selectedRunPilot === p.id ? ' selected' : '');
    btn.textContent = p.icon;
    btn.title = p.name + (unlocked ? '' : ' (locked)');
    btn.disabled = !unlocked;
    btn.addEventListener('click', () => {
      selectedRunPilot = p.id;
      STATE.selectedPilot = p.id;
      saveState(STATE);
      renderPlayEntry();
    });
    row.appendChild(btn);
  });

  updateHudStatic({score:0, shards:STATE.shards, lives:3, depth:1, elapsed:0, depthProgress:0});
}

function updateHudStatic(d){
  document.getElementById('hud-score').textContent = d.score;
  document.getElementById('hud-shards').textContent = STATE.shards.toLocaleString();
  document.getElementById('hud-hearts').textContent = '♥'.repeat(Math.max(d.lives,0)) + '♡'.repeat(Math.max(3-d.lives,0));
  document.getElementById('hud-level').textContent = d.depth;
  const mins = Math.floor(d.elapsed/60).toString().padStart(2,'0');
  const secs = Math.floor(d.elapsed%60).toString().padStart(2,'0');
  document.getElementById('hud-time').textContent = mins+':'+secs;
  document.getElementById('progress-fill').style.width = Math.min(100, d.depthProgress*100)+'%';
}

document.getElementById('btn-start-run').addEventListener('click', startRun);
document.getElementById('btn-retry').addEventListener('click', startRun);

function startRun(){
  document.getElementById('overlay-start').classList.add('hidden');
  document.getElementById('overlay-gameover').classList.add('hidden');
  document.getElementById('overlay-pause').classList.add('hidden');

  const pilot = getPilot(selectedRunPilot);
  const runtimeCfg = pilotRuntimeConfig(pilot);

  Game.start({
    pilot: runtimeCfg,
    difficulty: STATE.settings.difficulty,
    onUpdateHud: updateHudStatic,
    onGameOver: handleGameOver
  });
}

function handleGameOver(result){
  STATE.totalRuns += 1;
  STATE.totalShardsEarned += result.shards;
  STATE.shards += result.shards;
  STATE.totalTimePlayed += result.elapsed;
  const isNewBest = result.score > STATE.bestScore;
  STATE.bestScore = Math.max(STATE.bestScore, result.score);
  STATE.bestDepth = Math.max(STATE.bestDepth, result.depth);

  STATE.history.unshift({
    date: new Date().toLocaleDateString(), score: result.score, depth: result.depth,
    shards: result.shards, result: 'Breached'
  });
  STATE.history = STATE.history.slice(0, 25);

  checkMissionsAfterRun(result);
  checkAchievements();
  saveState(STATE);
  refreshNavCurrency();

  document.getElementById('result-score').textContent = result.score.toLocaleString();
  document.getElementById('result-shards').textContent = result.shards;
  document.getElementById('result-level').textContent = result.depth;
  document.getElementById('result-best').textContent = STATE.bestScore.toLocaleString();
  document.getElementById('new-best-banner').classList.toggle('hidden', !isNewBest);
  document.getElementById('overlay-gameover').classList.remove('hidden');
}

document.getElementById('btn-pause').addEventListener('click', () => {
  if(!Game.running) return;
  Game.pause();
  document.getElementById('overlay-pause').classList.remove('hidden');
});
document.getElementById('btn-resume').addEventListener('click', () => {
  Game.resume();
  document.getElementById('overlay-pause').classList.add('hidden');
});
document.getElementById('btn-quit').addEventListener('click', () => {
  Game.quit();
  document.getElementById('overlay-pause').classList.add('hidden');
  navigate('home');
});

// mobile controls
document.getElementById('touch-left').addEventListener('click', () => Game.moveLane(-1));
document.getElementById('touch-right').addEventListener('click', () => Game.moveLane(1));
document.getElementById('touch-boost').addEventListener('click', () => Game.boost());

// ---------- CHARACTERS SCREEN ----------
function renderCharacters(){
  const grid = document.getElementById('pilot-grid');
  grid.innerHTML = '';
  PILOTS.forEach(p => {
    const unlocked = isPilotUnlocked(p.id);
    const div = document.createElement('div');
    div.className = 'glass-card pilot-full-card';
    div.innerHTML = `
      ${!unlocked ? `<span class="lock-badge">🔒 ${p.cost} ◆</span>` : (STATE.selectedPilot===p.id ? `<span class="lock-badge">✓ Equipped</span>` : '')}
      <span class="p-icon">${p.icon}</span>
      <h3>${p.name}</h3>
      <span class="pilot-tag">${p.tag}</span>
      <div class="pilot-stats-mini">
        <div><b>${p.speed}x</b>Speed</div>
        <div><b>${p.hitbox}x</b>Hitbox</div>
        <div><b>${p.magnet}x</b>Magnet</div>
      </div>
      <div class="pilot-ability">${p.ability}</div>
    `;
    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn ' + (unlocked ? 'btn-primary' : 'btn-ghost');
    actionBtn.style.width = '100%';
    actionBtn.style.justifyContent = 'center';
    if(unlocked){
      actionBtn.textContent = STATE.selectedPilot === p.id ? 'Equipped' : 'Equip';
      actionBtn.disabled = STATE.selectedPilot === p.id;
      actionBtn.addEventListener('click', () => {
        STATE.selectedPilot = p.id;
        selectedRunPilot = p.id;
        saveState(STATE);
        toast(p.name + ' equipped.');
        renderCharacters();
      });
    } else {
      actionBtn.textContent = 'Unlock for ' + p.cost + ' ◆';
      actionBtn.addEventListener('click', () => {
        if(STATE.shards >= p.cost){
          STATE.shards -= p.cost;
          STATE.unlockedPilots.push(p.id);
          saveState(STATE);
          refreshNavCurrency();
          checkAchievements();
          toast(p.name + ' unlocked!', 'gold');
          renderCharacters();
        } else {
          toast('Not enough shards. Play more runs or visit the Shop.', 'warn');
        }
      });
    }
    div.appendChild(actionBtn);
    grid.appendChild(div);
  });
}

// ---------- SHOP SCREEN ----------
let currentShopTab = 'skins';
document.querySelectorAll('.shop-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentShopTab = tab.dataset.shoptab;
    renderShop();
  });
});

function renderShop(){
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  SHOP_ITEMS[currentShopTab].forEach(item => {
    const owned = isItemOwned(item.id);
    const div = document.createElement('div');
    div.className = 'glass-card shop-item';
    div.innerHTML = `
      <span class="s-icon">${item.icon}</span>
      <h4>${item.name}</h4>
      <p>${item.desc}</p>
      <div class="shop-price">${owned ? 'OWNED' : item.price + ' ◆'}</div>
    `;
    const btn = document.createElement('button');
    btn.className = 'btn ' + (owned ? 'btn-ghost' : 'btn-primary');
    btn.style.width = '100%'; btn.style.justifyContent='center';
    btn.textContent = owned ? 'Equipped' : 'Buy';
    btn.disabled = owned;
    btn.addEventListener('click', () => {
      if(STATE.shards >= item.price){
        STATE.shards -= item.price;
        STATE.ownedItems.push(item.id);
        saveState(STATE);
        refreshNavCurrency();
        toast(item.name + ' added to inventory.', 'gold');
        renderShop();
        renderInventory();
      } else {
        toast('Not enough shards for ' + item.name + '.', 'warn');
      }
    });
    div.appendChild(btn);
    grid.appendChild(div);
  });
  renderInventory();
}

function renderInventory(){
  const row = document.getElementById('inventory-row');
  row.innerHTML = '';
  if(STATE.ownedItems.length === 0){
    row.innerHTML = '<p class="lede">No items owned yet. Purchases will appear here.</p>';
    return;
  }
  STATE.ownedItems.forEach(id => {
    let item = null;
    for(const cat in SHOP_ITEMS){ const f = SHOP_ITEMS[cat].find(i=>i.id===id); if(f){item=f;break;} }
    if(!item) return;
    const chip = document.createElement('div');
    chip.className = 'inv-chip';
    chip.innerHTML = `<span>${item.icon}</span><span>${item.name}</span>`;
    row.appendChild(chip);
  });
}

// ---------- LEADERBOARD SCREEN ----------
function renderLeaderboard(){
  const myEntry = { name: STATE.username + ' (You)', score: STATE.bestScore, depth: STATE.bestDepth, pilot: getPilot(STATE.selectedPilot).name, isMe: true };
  const all = BOT_LEADERBOARD.map(b => Object.assign({isMe:false}, b)).concat([myEntry])
    .sort((a,b) => b.score - a.score);

  const podiumEl = document.getElementById('podium');
  podiumEl.innerHTML = '';
  const top3 = all.slice(0,3);
  const order = [1,0,2]; // 2nd, 1st, 3rd visual order
  const heights = [110, 150, 90];
  const colors = ['#c0c0c0', '#ffd23f', '#cd7f32'];
  order.forEach((idx, visualIdx) => {
    const p = top3[idx];
    if(!p) return;
    const spot = document.createElement('div');
    spot.className = 'podium-spot';
    spot.innerHTML = `
      <div class="podium-name">${idx===0?'🥇':idx===1?'🥈':'🥉'} ${p.name}</div>
      <div class="podium-score mono">${p.score.toLocaleString()}</div>
      <div class="podium-bar" style="height:${heights[visualIdx]}px; background:linear-gradient(180deg, ${colors[idx]}55, transparent);"></div>
    `;
    podiumEl.appendChild(spot);
  });

  const tbody = document.getElementById('lb-tbody');
  tbody.innerHTML = '';
  all.forEach((p, i) => {
    const tr = document.createElement('tr');
    if(p.isMe) tr.className = 'me';
    tr.innerHTML = `<td>#${i+1}</td><td>${p.name}</td><td class="mono">${p.score.toLocaleString()}</td><td class="mono">${p.depth}</td><td>${p.pilot}</td>`;
    tbody.appendChild(tr);
  });

  renderBadges('badge-grid');
}

function renderBadges(containerId){
  const grid = document.getElementById(containerId);
  grid.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const unlocked = STATE.unlockedAchievements.indexOf(a.id) !== -1;
    const div = document.createElement('div');
    div.className = 'badge' + (unlocked ? '' : ' locked');
    div.innerHTML = `<span class="b-icon">${a.icon}</span><h5>${a.name}</h5><p>${a.desc}</p>`;
    grid.appendChild(div);
  });
}

// ---------- PROFILE SCREEN ----------
function renderProfile(){
  document.getElementById('profile-avatar').textContent = STATE.avatar;
  document.getElementById('profile-name-input').value = STATE.username;
  document.getElementById('profile-pilot-label').textContent = 'Pilot: ' + getPilot(STATE.selectedPilot).name;
  document.getElementById('pstat-best').textContent = STATE.bestScore.toLocaleString();
  document.getElementById('pstat-total').textContent = STATE.totalShardsEarned.toLocaleString();
  document.getElementById('pstat-runs').textContent = STATE.totalRuns;
  document.getElementById('pstat-time').textContent = Math.round(STATE.totalTimePlayed/60) + 'm';

  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';
  if(STATE.history.length === 0){
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-low)">No runs yet — head to Play to start your first run.</td></tr>';
  } else {
    STATE.history.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${h.date}</td><td class="mono">${h.score.toLocaleString()}</td><td class="mono">${h.depth}</td><td class="mono">${h.shards}</td><td>${h.result}</td>`;
      tbody.appendChild(tr);
    });
  }
  renderBadges('profile-badges');
}

document.getElementById('profile-name-input').addEventListener('change', (e) => {
  const v = e.target.value.trim();
  STATE.username = v || 'Runner';
  saveState(STATE);
  refreshNavCurrency();
  toast('Callsign updated.');
});

const AVATAR_OPTIONS = ['🛸','👾','🤖','👁️','🦾','🌌','⚡','💀','👽','🐉'];
document.getElementById('btn-change-avatar').addEventListener('click', () => {
  let idx = AVATAR_OPTIONS.indexOf(STATE.avatar);
  idx = (idx + 1) % AVATAR_OPTIONS.length;
  STATE.avatar = AVATAR_OPTIONS[idx];
  saveState(STATE);
  document.getElementById('profile-avatar').textContent = STATE.avatar;
});

// ---------- SETTINGS SCREEN ----------
function renderSettings(){
  document.getElementById('set-music-vol').value = STATE.settings.musicVol;
  document.getElementById('set-sfx-vol').value = STATE.settings.sfxVol;
  document.getElementById('set-mute').dataset.on = STATE.settings.muted;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === STATE.settings.difficulty));
  document.querySelectorAll('.theme-swatch').forEach(b => b.classList.toggle('active', b.dataset.theme === STATE.settings.theme));
}

document.getElementById('set-music-vol').addEventListener('input', (e) => {
  STATE.settings.musicVol = +e.target.value;
  Game.setVolumes(STATE.settings.musicVol, STATE.settings.sfxVol, STATE.settings.muted);
  saveState(STATE);
});
document.getElementById('set-sfx-vol').addEventListener('input', (e) => {
  STATE.settings.sfxVol = +e.target.value;
  Game.setVolumes(STATE.settings.musicVol, STATE.settings.sfxVol, STATE.settings.muted);
  saveState(STATE);
});
document.getElementById('set-mute').addEventListener('click', (e) => {
  STATE.settings.muted = !STATE.settings.muted;
  e.currentTarget.dataset.on = STATE.settings.muted;
  Game.setVolumes(STATE.settings.musicVol, STATE.settings.sfxVol, STATE.settings.muted);
  saveState(STATE);
});
document.querySelectorAll('.diff-btn').forEach(b => {
  b.addEventListener('click', () => {
    STATE.settings.difficulty = b.dataset.diff;
    saveState(STATE);
    renderSettings();
    toast('Difficulty set to ' + b.dataset.diff + '.');
  });
});
document.querySelectorAll('.theme-swatch').forEach(b => {
  b.addEventListener('click', () => {
    applyTheme(b.dataset.theme);
    STATE.settings.theme = b.dataset.theme;
    saveState(STATE);
    renderSettings();
  });
});

const THEME_COLORS = {
  cyan: '125,249,255', magenta: '255,45,149', violet: '157,78,255', gold: '255,210,63', green: '61,255,160'
};
function applyTheme(themeName){
  const rgb = THEME_COLORS[themeName] || THEME_COLORS.cyan;
  document.documentElement.style.setProperty('--accent-rgb', rgb);
  document.documentElement.style.setProperty('--accent', 'rgb(' + rgb + ')');
}

document.getElementById('btn-export-save').addEventListener('click', () => {
  const data = JSON.stringify(STATE, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'voidrunner-save.json';
  a.click();
  toast('Save exported.');
});
document.getElementById('btn-reset-save').addEventListener('click', () => {
  if(confirm('Reset all progress? This cannot be undone.')){
    localStorage.removeItem(SAVE_KEY);
    STATE = loadState();
    ensureDailyReset(STATE);
    saveState(STATE);
    applyTheme(STATE.settings.theme);
    refreshNavCurrency();
    navigate('home');
    toast('Progress reset.');
  }
});

// ---------- EASTER EGG ----------
let navClickSequence = [];
function checkEasterEggTrigger(screenId){
  navClickSequence.push(screenId);
  if(navClickSequence.length > 5) navClickSequence.shift();
  const target = ['settings','shop','characters','shop','settings'];
  if(JSON.stringify(navClickSequence) === JSON.stringify(target) && !STATE.eggFound){
    document.getElementById('egg-modal').classList.remove('hidden');
  }
}
// Also trigger via konami-esque click on brand mark 5 times
let brandClicks = 0;
document.querySelector('.brand-mark').addEventListener('click', (e) => {
  e.stopPropagation();
  brandClicks++;
  if(brandClicks >= 5 && !STATE.eggFound){
    document.getElementById('egg-modal').classList.remove('hidden');
    brandClicks = 0;
  }
});
document.getElementById('egg-close').addEventListener('click', () => {
  document.getElementById('egg-modal').classList.add('hidden');
});
document.getElementById('egg-claim').addEventListener('click', () => {
  STATE.eggFound = true;
  STATE.shards += 500;
  saveState(STATE);
  refreshNavCurrency();
  checkAchievements();
  document.getElementById('egg-modal').classList.add('hidden');
  toast('+500 shards claimed from the Rift Echo.', 'gold');
});

// ---------- INIT ----------
applyTheme(STATE.settings.theme);
refreshNavCurrency();
navigate('home');
