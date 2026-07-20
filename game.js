// ============== VOIDRUNNER GAME ENGINE ==============

const Game = (function(){
  let canvas, ctx, W, H;
  let running = false, paused = false;
  let rafId = null;

  // runtime state
  let player, obstacles, collectibles, particles;
  let score, shards, lives, depth, elapsed, lastTime;
  let speed, spawnTimer, depthTimer;
  let dailyShardsThisRun = 0;
  let usedSlowmo = false, slowmoActive = false, slowmoTimer = 0;
  let usedRevive = false;
  let pilotConfig, difficultyConfig, onGameOver, onUpdateHud;
  let muted = false, sfxVol = 0.8, musicVol = 0.6;

  const DIFFS = {
    easy:   { speedMul: 0.75, spawnMul: 1.35, shardMul: 0.8 },
    normal: { speedMul: 1.0,  spawnMul: 1.0,  shardMul: 1.0 },
    hard:   { speedMul: 1.3,  spawnMul: 0.78, shardMul: 1.3 },
    void:   { speedMul: 1.65, spawnMul: 0.6,  shardMul: 1.7 }
  };

  // ---------- AUDIO (WebAudio synthesis, no external files needed) ----------
  let actx = null;
  function audioCtx(){
    if(!actx){
      try{ actx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; }
    }
    return actx;
  }
  function beep(freq, dur, type, vol, slideTo){
    if(muted) return;
    const ac = audioCtx(); if(!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if(slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    gain.gain.setValueAtTime((vol||0.2)*sfxVol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(); osc.stop(ac.currentTime + dur);
  }
  const SFX = {
    coin: function(){ beep(880, 0.12, 'triangle', 0.18, 1320); },
    gem: function(){ beep(660, 0.15, 'sine', 0.2, 990); },
    key: function(){ beep(440, 0.2, 'square', 0.15, 880); },
    power: function(){ beep(220, 0.3, 'sawtooth', 0.18, 660); },
    hit: function(){ beep(120, 0.25, 'sawtooth', 0.25, 60); },
    boost: function(){ beep(300, 0.18, 'square', 0.12, 500); },
    gameover: function(){ beep(200,0.4,'sawtooth',0.2,50); setTimeout(function(){beep(150,0.5,'sawtooth',0.2,40);},150); },
    levelup: function(){ beep(523,0.12,'sine',0.18,659); setTimeout(function(){beep(659,0.12,'sine',0.18,784);},120); }
  };

  let musicNodes = null;
  function startMusic(){
    if(muted) return stopMusic();
    const ac = audioCtx(); if(!ac) return;
    stopMusic();
    const osc1 = ac.createOscillator(); osc1.type='sine'; osc1.frequency.value=110;
    const osc2 = ac.createOscillator(); osc2.type='sine'; osc2.frequency.value=164.81;
    const gain = ac.createGain(); gain.gain.value = 0.05*musicVol;
    osc1.connect(gain); osc2.connect(gain); gain.connect(ac.destination);
    osc1.start(); osc2.start();
    musicNodes = {osc1: osc1, osc2: osc2, gain: gain};
  }
  function stopMusic(){
    if(musicNodes){
      try{ musicNodes.osc1.stop(); musicNodes.osc2.stop(); }catch(e){}
      musicNodes = null;
    }
  }
  function setVolumes(m, s, isMuted){
    musicVol = m/100; sfxVol = s/100; muted = isMuted;
    if(musicNodes) musicNodes.gain.gain.value = 0.05*musicVol*(muted?0:1);
  }

  function rand(a,b){ return a + Math.random()*(b-a); }

  function resetEntities(){
    player = { lane: 1, x:0, y:0, targetX:0, w:36, h:36, hitFlash:0, shieldActive: !!(pilotConfig && pilotConfig.startShield) };
    obstacles = [];
    collectibles = [];
    particles = [];
    score = 0; shards = 0; depth = 1; elapsed = 0;
    lives = 3;
    speed = 4 * difficultyConfig.speedMul;
    spawnTimer = 1; depthTimer = 0;
    dailyShardsThisRun = 0;
    usedSlowmo = !(pilotConfig && pilotConfig.hasSlowmo);
    usedRevive = !(pilotConfig && pilotConfig.hasRevive);
  }

  function laneX(lane){
    const laneWidth = W/3;
    return laneWidth*lane + laneWidth/2;
  }

  function spawnWave(){
    const lanes = [0,1,2];
    const roll = Math.random();
    if(roll < 0.55){
      const blockCount = Math.random() < 0.3 ? 2 : 1;
      const shuffled = lanes.slice().sort(function(){return Math.random()-0.5;});
      for(let i=0;i<blockCount;i++){
        obstacles.push({ lane: shuffled[i], y: -60, w: 50, h: 50, hit:false });
      }
      if(Math.random() < 0.6){
        const used = shuffled.slice(0,blockCount);
        const freeLanes = lanes.filter(function(l){ return used.indexOf(l) === -1; });
        const l = freeLanes[Math.floor(Math.random()*freeLanes.length)];
        collectibles.push(makeCollectible(l));
      }
    } else {
      const c = Math.random() < 0.5 ? 1 : 2;
      const shuffled = lanes.slice().sort(function(){return Math.random()-0.5;});
      for(let i=0;i<c;i++){
        collectibles.push(makeCollectible(shuffled[i]));
      }
    }
  }

  function makeCollectible(lane){
    const roll = Math.random();
    let type = 'coin';
    if(roll > 0.92) type = 'core';
    else if(roll > 0.78) type = 'key';
    else if(roll > 0.55) type = 'gem';
    return { lane: lane, y:-40, w:26, h:26, type: type, collected:false, bob: Math.random()*10 };
  }

  function spawnParticles(x,y,color,count){
    count = count || 10;
    for(let i=0;i<count;i++){
      particles.push({ x:x, y:y, vx: rand(-3,3), vy: rand(-4,1), life: 1, color: color, size: rand(2,5) });
    }
  }

  function moveLane(dir){
    player.lane = Math.max(0, Math.min(2, player.lane + dir));
  }
  function boost(){
    speed += 2.5;
    SFX.boost();
    setTimeout(function(){ speed = Math.max(speed-2.5, 4*difficultyConfig.speedMul); }, 600);
  }
  function triggerSlowmo(){
    if(usedSlowmo) return;
    usedSlowmo = true;
    slowmoActive = true;
    slowmoTimer = 3;
  }

  function handleKey(e){
    if(!running || paused) return;
    const k = e.key.toLowerCase();
    if(e.key === 'ArrowLeft' || k==='a') moveLane(-1);
    if(e.key === 'ArrowRight' || k==='d') moveLane(1);
    if(e.key === ' ' || e.key === 'ArrowUp' || k==='w'){ e.preventDefault(); boost(); }
    if(e.key === 'Shift') triggerSlowmo();
  }

  function checkCollisions(){
    const px = laneX(player.lane);
    const py = H - 90;
    const hbW = player.w * (pilotConfig.hitbox || 1);

    for(let i=0;i<obstacles.length;i++){
      const o = obstacles[i];
      if(o.hit) continue;
      const ox = laneX(o.lane);
      if(Math.abs(ox-px) < (hbW/2 + o.w/2) && Math.abs(o.y - py) < (o.h/2 + player.h/2)){
        o.hit = true;
        onPlayerHit();
      }
    }

    const magnetRadius = 40 * (pilotConfig.magnet || 1);
    for(let i=0;i<collectibles.length;i++){
      const c = collectibles[i];
      if(c.collected) continue;
      const cx = laneX(c.lane);
      const dist = Math.hypot(cx-px, c.y-py);
      if(dist < magnetRadius){
        c.collected = true;
        onCollect(c, cx, c.y);
      }
    }
  }

  function onPlayerHit(){
    if(player.shieldActive){
      player.shieldActive = false;
      spawnParticles(laneX(player.lane), H-90, '#7df9ff', 16);
      SFX.power();
      return;
    }
    lives -= 1;
    player.hitFlash = 0.4;
    SFX.hit();
    spawnParticles(laneX(player.lane), H-90, '#ff2d95', 18);
    if(navigator.vibrate) navigator.vibrate(80);
    if(lives <= 0){
      if(!usedRevive){
        usedRevive = true;
        lives = 1;
        spawnParticles(laneX(player.lane), H-90, '#3dffa0', 24);
        return;
      }
      endRun(false);
    }
  }

  function onCollect(c, x, y){
    let pts = 0, sh = 0, color = '#ffd23f';
    if(c.type === 'coin'){ pts = 10; sh = 1; color='#ffd23f'; SFX.coin(); }
    else if(c.type === 'gem'){ pts = 25; sh = 3; color='#9d4eff'; SFX.gem(); }
    else if(c.type === 'key'){ pts = 50; sh = 5; color='#7df9ff'; SFX.key(); }
    else if(c.type === 'core'){ pts = 100; sh = 10; color='#3dffa0'; SFX.power(); player.shieldActive = true; }
    score += Math.round(pts * (1 + depth*0.05));
    shards += sh;
    dailyShardsThisRun += sh;
    spawnParticles(x, y, color, 10);
  }

  function update(dt){
    elapsed += dt;
    depthTimer += dt;

    if(slowmoActive){
      slowmoTimer -= dt;
      if(slowmoTimer <= 0) slowmoActive = false;
    }
    const dtScale = slowmoActive ? 0.4 : 1;

    player.targetX = laneX(player.lane);
    player.x += (player.targetX - player.x) * 0.22;
    if(player.hitFlash > 0) player.hitFlash -= dt;

    if(depthTimer > 8){
      depthTimer = 0;
      depth += 1;
      speed += 0.5 * difficultyConfig.speedMul;
      SFX.levelup();
    }

    const moveSpeed = speed * dtScale;

    spawnTimer -= dt;
    if(spawnTimer <= 0){
      spawnWave();
      spawnTimer = rand(0.7, 1.3) * difficultyConfig.spawnMul;
    }

    for(let i=0;i<obstacles.length;i++) obstacles[i].y += moveSpeed;
    for(let i=0;i<collectibles.length;i++) collectibles[i].y += moveSpeed;
    obstacles = obstacles.filter(function(o){ return o.y < H + 80 && !o.hit; });
    collectibles = collectibles.filter(function(c){ return c.y < H + 60 && !c.collected; });

    for(let i=0;i<particles.length;i++){
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= dt*1.5;
    }
    particles = particles.filter(function(p){ return p.life > 0; });

    checkCollisions();
    score += dt * 5 * (1+depth*0.02);
    score = Math.round(score);
  }

  function draw(){
    ctx.clearRect(0,0,W,H);

    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, '#0a0e1f');
    grad.addColorStop(1, '#03040a');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = 'rgba(125,249,255,0.12)';
    ctx.lineWidth = 2;
    for(let l=1;l<3;l++){
      ctx.beginPath();
      ctx.moveTo(W/3*l, 0);
      ctx.lineTo(W/3*l, H);
      ctx.stroke();
    }

    const t = performance.now()/100;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for(let i=0;i<6;i++){
      const y = ((t*speed*4 + i*120) % (H+100)) - 50;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }

    for(let i=0;i<obstacles.length;i++){
      const o = obstacles[i];
      const x = laneX(o.lane);
      ctx.save();
      ctx.translate(x, o.y);
      ctx.fillStyle = '#ff2d95';
      ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0,-o.h/2); ctx.lineTo(o.w/2,0); ctx.lineTo(0,o.h/2); ctx.lineTo(-o.w/2,0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    for(let i=0;i<collectibles.length;i++){
      const c = collectibles[i];
      const x = laneX(c.lane);
      const bob = Math.sin(performance.now()/200 + c.bob)*4;
      ctx.save();
      ctx.translate(x, c.y+bob);
      let color = '#ffd23f', shape='circle';
      if(c.type==='gem'){ color='#9d4eff'; shape='diamond'; }
      if(c.type==='key'){ color='#7df9ff'; shape='hex'; }
      if(c.type==='core'){ color='#3dffa0'; shape='star'; }
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14;
      if(shape==='circle'){ ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); }
      else if(shape==='diamond'){ ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(11,0); ctx.lineTo(0,13); ctx.lineTo(-11,0); ctx.closePath(); ctx.fill(); }
      else if(shape==='hex'){
        ctx.beginPath();
        for(let i2=0;i2<6;i2++){ const a=Math.PI/3*i2; const px=Math.cos(a)*12, py=Math.sin(a)*12; if(i2===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath();
        for(let i2=0;i2<10;i2++){ const a=Math.PI/5*i2 - Math.PI/2; const r=i2%2===0?14:6; const px=Math.cos(a)*r, py=Math.sin(a)*r; if(i2===0) ctx.moveTo(px,py); else ctx.lineTo(px,py); }
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    for(let i=0;i<particles.length;i++){
      const p = particles[i];
      ctx.globalAlpha = Math.max(p.life,0);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    const py = H - 90;
    ctx.save();
    ctx.translate(player.x, py);
    if(player.hitFlash > 0){
      ctx.globalAlpha = 0.5 + 0.5*Math.sin(performance.now()/30);
    }
    if(player.shieldActive){
      ctx.beginPath();
      ctx.strokeStyle = '#7df9ff'; ctx.lineWidth = 2; ctx.shadowColor='#7df9ff'; ctx.shadowBlur=16;
      ctx.arc(0,0,28,0,Math.PI*2); ctx.stroke();
    }
    ctx.fillStyle = (pilotConfig && pilotConfig.color) || '#7df9ff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(0,-20); ctx.lineTo(16,16); ctx.lineTo(0,8); ctx.lineTo(-16,16);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    if(slowmoActive){
      ctx.fillStyle = 'rgba(125,249,255,0.06)';
      ctx.fillRect(0,0,W,H);
    }
  }

  function loop(ts){
    if(!running) return;
    if(paused){ lastTime = ts; rafId = requestAnimationFrame(loop); return; }
    const dt = Math.min((ts - lastTime)/1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    if(onUpdateHud) onUpdateHud({ score: score, shards: shards, lives: lives, depth: depth, elapsed: elapsed, depthProgress: depthTimer/8 });
    rafId = requestAnimationFrame(loop);
  }

  function endRun(survived){
    running = false;
    cancelAnimationFrame(rafId);
    stopMusic();
    SFX.gameover();
    if(onGameOver) onGameOver({ score: score, shards: shards, depth: depth, elapsed: elapsed, survived: survived, dailyShardsThisRun: dailyShardsThisRun });
  }

  function setupTouch(){
    let touchStartX = null;
    canvas.addEventListener('touchstart', function(e){
      touchStartX = e.touches[0].clientX;
    });
    canvas.addEventListener('touchend', function(e){
      if(touchStartX === null) return;
      const dx = (e.changedTouches[0].clientX - touchStartX);
      if(Math.abs(dx) > 30){ moveLane(dx > 0 ? 1 : -1); }
      else { boost(); }
      touchStartX = null;
    });
  }

  function init(canvasEl){
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    function fit(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      W = rect.width; H = rect.height;
    }
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('keydown', handleKey);
    setupTouch();
  }

  function start(opts){
    pilotConfig = opts.pilot;
    difficultyConfig = DIFFS[opts.difficulty] || DIFFS.normal;
    onGameOver = opts.onGameOver;
    onUpdateHud = opts.onUpdateHud;
    resetEntities();
    player.x = laneX(1);
    running = true; paused = false;
    lastTime = performance.now();
    startMusic();
    rafId = requestAnimationFrame(loop);
  }

  function pause(){ paused = true; }
  function resume(){ paused = false; lastTime = performance.now(); }
  function quit(){ running = false; cancelAnimationFrame(rafId); stopMusic(); }

  return {
    init: init, start: start, pause: pause, resume: resume, quit: quit, setVolumes: setVolumes,
    moveLane: moveLane, boost: boost, triggerSlowmo: triggerSlowmo,
    get running(){ return running; },
    get paused(){ return paused; }
  };
})();
