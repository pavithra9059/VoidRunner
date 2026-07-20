// ============== AMBIENT BACKGROUND CANVAS ==============
(function(){
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, stars = [], lines = [];

  function getAccentRGB(){
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
    return v || '125,249,255';
  }

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function initStars(){
    stars = [];
    const count = Math.floor((w*h)/9000);
    for(let i=0;i<count;i++){
      stars.push({
        x: Math.random()*w, y: Math.random()*h,
        z: Math.random()*1 + 0.2,
        r: Math.random()*1.4 + 0.3
      });
    }
  }
  initStars();
  window.addEventListener('resize', initStars);

  function initLines(){
    lines = [];
    for(let i=0;i<6;i++){
      lines.push({ angle: (Math.PI*2/6)*i, offset: Math.random()*1000 });
    }
  }
  initLines();

  let t = 0;
  function draw(){
    t += 0.45;
    ctx.clearRect(0,0,w,h);

    // deep radial glow
    const cx = w*0.5, cy = h*0.38;
    const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*0.6);
    const accent = getAccentRGB();
    grad.addColorStop(0, `rgba(${accent},0.10)`);
    grad.addColorStop(0.5, 'rgba(157,78,255,0.04)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);

    // stars drifting slowly downward (parallax)
    ctx.save();
    for(const s of stars){
      s.y += 0.12 * s.z;
      if(s.y > h) s.y = 0;
      ctx.globalAlpha = 0.4 + 0.4*Math.sin(t*0.01 + s.x);
      ctx.fillStyle = `rgba(${accent},${0.5*s.z})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // rotating tunnel rings (very subtle)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.12;
    for(let ring=1; ring<=4; ring++){
      const radius = ring*90 + (t*1.2 % 90);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${accent},${0.5 - ring*0.1})`;
      ctx.lineWidth = 1;
      ctx.arc(0,0, radius, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();

    requestAnimationFrame(draw);
  }
  draw();

  // expose for theme refresh
  window.__bgCanvasRefresh = () => {};
})();
