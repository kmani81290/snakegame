
// Friends-inspired Snake — Central Perk Dash (original assets; no copyrighted audio/images).

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const speedEl = document.getElementById('speed');
const modeEl = document.getElementById('mode');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const muteBtn = document.getElementById('muteBtn');

// Grid
const CELL = 20;
const COLS = canvas.width / CELL | 0;
const ROWS = canvas.height / CELL | 0;

// Game state
let snake, dir, nextDir, food, obstacles, powerUps, speedMul, ghostTicks, score, best, running, stepMs, lastStep = 0;

// Themes
const THEMES = {
  classic: { board:'#101012', grid:'#1b1b22', snake:'#6fbf73', head:'#9be59f', food:'#f2a365', wall:'#e46464', power:'#f6ce2f', text:'#f3f3f3' },
  soho:    { board:'#0f0f12', grid:'#1d1f27', snake:'#e2aaff', head:'#ffd3f7', food:'#8ad1ff', wall:'#ff8a8a', power:'#f6ce2f', text:'#f3f3f3' },
  loft:    { board:'#121516', grid:'#1c2323', snake:'#8cd6b1', head:'#c9ffe1', food:'#ffd384', wall:'#ea6a6a', power:'#f6ce2f', text:'#f3f3f3' },
};
let themeKey = localStorage.getItem('theme') || 'classic';
let theme = THEMES[themeKey];
document.querySelectorAll('.theme').forEach(btn => btn.addEventListener('click', () => {
  themeKey = btn.dataset.theme;
  localStorage.setItem('theme', themeKey);
  theme = THEMES[themeKey];
  modeEl.textContent = btn.textContent;
  draw();
}));

// Input
const DIRS = { left:{x:-1,y:0}, right:{x:1,y:0}, up:{x:0,y:-1}, down:{x:0,y:1} };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowleft','a'].includes(k) && dir !== DIRS.right) nextDir = DIRS.left;
  if (['arrowright','d'].includes(k) && dir !== DIRS.left) nextDir = DIRS.right;
  if (['arrowup','w'].includes(k) && dir !== DIRS.down) nextDir = DIRS.up;
  if (['arrowdown','s'].includes(k) && dir !== DIRS.up) nextDir = DIRS.down;
  if (k === ' ') togglePause();
});
document.querySelectorAll('.dpad').forEach(b => b.addEventListener('click', () => {
  const d = DIRS[b.dataset.dir];
  if (d === DIRS.left && dir !== DIRS.right) nextDir = d;
  if (d === DIRS.right && dir !== DIRS.left) nextDir = d;
  if (d === DIRS.up && dir !== DIRS.down) nextDir = d;
  if (d === DIRS.down && dir !== DIRS.up) nextDir = d;
}));

pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', () => { init(); });
muteBtn.addEventListener('click', () => { toggleAudio(); });

// Background "coffeehouse" loop via WebAudio (generated; no files)
let audio = {
  ctx: null, gain: null, playing: false
};
function setupAudio(){
  if (audio.ctx) return;
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  audio.gain = audio.ctx.createGain();
  audio.gain.gain.value = 0.15;
  audio.gain.connect(audio.ctx.destination);

  // Create a simple chord pad + soft pluck arpeggio
  const tempo = 92;
  const beat = 60/tempo;
  const scale = [0,2,4,7,9]; // major pentatonic
  let t0 = audio.ctx.currentTime + 0.1;

  function note(freq, start, dur, type='sine', vol=0.2){
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(audio.gain);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start+dur);
    o.start(start); o.stop(start+dur+0.01);
  }

  function freqFrom(semi){ return 220 * Math.pow(2, semi/12); } // A3 base
  function scheduleLoop(){
    const base = [0, -5, 2, -3]; // I, IV, V, ii (in semitone shifts)
    for(let bar=0; bar<4; bar++){
      const root = base[bar];
      // pad
      for(let k=0;k<3;k++){
        note(freqFrom(root + [0,4,7][k]), t0 + (bar*4)*beat, 4*beat, 'triangle', 0.05);
      }
      // arpeggio
      for(let s=0; s<8; s++){
        const semi = root + scale[s%scale.length];
        const time = t0 + (bar*4 + s*0.5)*beat;
        note(freqFrom(semi+12), time, 0.25*beat, 'sine', 0.12);
      }
      // soft kick
      for(let q=0;q<8;q++){
        const t = t0 + (bar*4 + q*0.5)*beat;
        const o = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        o.type = 'sine';
        o.connect(g); g.connect(audio.gain);
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(40, t+0.2*beat);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.25, t+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t+0.2*beat);
        o.start(t); o.stop(t+0.25*beat);
      }
    }
    t0 += 16*beat; // loop length
    if (audio.playing) setTimeout(scheduleLoop, 1000);
  }
  audio.playing = true;
  scheduleLoop();
}
function toggleAudio(){
  if (!audio.ctx){ setupAudio(); muteBtn.textContent = 'Mute'; return; }
  audio.playing = !audio.playing;
  audio.gain.gain.value = audio.playing ? 0.15 : 0.0;
  muteBtn.textContent = audio.playing ? 'Mute' : 'Unmute';
}

// Game helpers
function rndCell(){
  return { x: (Math.random()*COLS|0), y: (Math.random()*ROWS|0) };
}
function cellsEqual(a,b){ return a.x===b.x && a.y===b.y; }
function insideGrid(p){ return p.x>=0 && p.x<COLS && p.y>=0 && p.y<ROWS; }
function placeEntity(avoidSet){
  let p;
  do { p = rndCell(); } while (avoidSet.has(p.x+','+p.y));
  return p;
}

function init(){
  snake = [{x: COLS/2|0, y: ROWS/2|0}];
  dir = DIRS.right; nextDir = dir;
  speedMul = 1.0; ghostTicks = 0;
  score = 0; scoreEl.textContent = score;
  best = +localStorage.getItem('best') || 0; bestEl.textContent = best;
  obstacles = [];
  powerUps = [];
  // pre-place obstacles (couches) — avoid center area
  const avoid = new Set([snake[0].x+','+snake[0].y]);
  for (let i=0;i<20;i++){
    const p = placeEntity(avoid);
    if (Math.hypot(p.x-snake[0].x, p.y-snake[0].y) > 6) {
      obstacles.push(p); avoid.add(p.x+','+p.y);
    }
  }
  food = placeEntity(avoid);
  running = true; stepMs = 140; lastStep = 0;
  speedEl.textContent = (speedMul.toFixed(1))+'x';
  modeEl.textContent = document.querySelector('.theme.btn.tiny[data-theme="'+(localStorage.getItem('theme')||'classic')+'"]')?.textContent || 'Classic';
  draw();
}
init();

function spawnPowerUp(){
  const avoid = new Set(obstacles.map(p=>p.x+','+p.y));
  snake.forEach(s=>avoid.add(s.x+','+s.y));
  avoid.add(food.x+','+food.y);
  const p = placeEntity(avoid);
  // Types: espresso (speed), umbrella (ghost), turkey (+points)
  const types = ['espresso','umbrella','turkey'];
  const type = types[(Math.random()*types.length)|0];
  powerUps.push({ ...p, type, ttl: 600 });
}

function step(ts){
  if (!running) { requestAnimationFrame(step); return; }
  if (!lastStep) lastStep = ts;
  const interval = stepMs / speedMul;
  if (ts - lastStep >= interval){
    lastStep = ts;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    // Wrap or collide?
    if (!insideGrid(head)){
      gameOver(); return;
    }
    // Tail collision unless ghost
    const hitsTail = snake.some(s=>cellsEqual(s, head));
    const hitsWall = obstacles.some(o=>cellsEqual(o, head));
    if ((hitsTail || hitsWall) && ghostTicks<=0){ gameOver(); return; }
    if (ghostTicks>0) ghostTicks--;

    snake.unshift(head);
    if (cellsEqual(head, food)){
      score += 1; scoreEl.textContent = score;
      // Speed up slightly with score
      speedMul = Math.min(2.2, 1 + score*0.03);
      speedEl.textContent = speedMul.toFixed(1)+'x';
      // new food
      const avoid = new Set(obstacles.map(p=>p.x+','+p.y));
      snake.forEach(s=>avoid.add(s.x+','+s.y));
      food = placeEntity(avoid);
      // chance to spawn a power-up
      if (Math.random()<0.45) spawnPowerUp();
    } else {
      snake.pop();
    }

    // Power-up interactions
    for (let i=powerUps.length-1; i>=0; i--){
      const p = powerUps[i];
      p.ttl--;
      if (p.ttl<=0){ powerUps.splice(i,1); continue; }
      if (cellsEqual(head, p)){
        if (p.type==='espresso'){
          speedMul = Math.min(3.0, speedMul + 0.8);
          speedEl.textContent = speedMul.toFixed(1)+'x';
          flash('#f6ce2f');
        } else if (p.type==='umbrella'){
          ghostTicks = 20; // pass-through for 20 moves
          flash('#8ad1ff');
        } else if (p.type==='turkey'){
          score += 5; scoreEl.textContent = score;
          flash('#ffd384');
        }
        powerUps.splice(i,1);
      }
    }
    draw();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

function gameOver(){
  running = false;
  best = Math.max(best, score); bestEl.textContent = best;
  localStorage.setItem('best', best);
  flash(theme.wall);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = theme.text;
  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', canvas.width/2, canvas.height/2 - 10);
  ctx.font = '16px Inter, system-ui, sans-serif';
  ctx.fillText('Press Restart', canvas.width/2, canvas.height/2 + 20);
  ctx.restore();
}

function togglePause(){
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
  if (running) requestAnimationFrame(step);
}

// Visuals
function draw(){
  // bg
  ctx.fillStyle = theme.board;
  ctx.fillRect(0,0,canvas.width, canvas.height);
  // grid
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  for (let x=0; x<=COLS; x++){
    ctx.beginPath(); ctx.moveTo(x*CELL+0.5,0); ctx.lineTo(x*CELL+0.5, canvas.height); ctx.stroke();
  }
  for (let y=0; y<=ROWS; y++){
    ctx.beginPath(); ctx.moveTo(0,y*CELL+0.5); ctx.lineTo(canvas.width, y*CELL+0.5); ctx.stroke();
  }
  // obstacles
  ctx.fillStyle = theme.wall;
  obstacles.forEach(o => roundCell(o.x,o.y,6));
  // power-ups
  powerUps.forEach(p=>{
    if (p.type==='espresso'){ drawEspresso(p.x,p.y); }
    if (p.type==='umbrella'){ drawUmbrella(p.x,p.y); }
    if (p.type==='turkey'){ drawTurkey(p.x,p.y); }
  });
  // food
  ctx.fillStyle = theme.food;
  drawDonut(food.x, food.y);
  // snake
  snake.forEach((s,i)=>{
    ctx.fillStyle = i===0 ? theme.head : theme.snake;
    roundCell(s.x,s.y,6);
  });
}

function roundCell(cx, cy, r){
  const x = cx*CELL, y = cy*CELL, w = CELL, h = CELL;
  const rr = r;
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
  ctx.fill();
}

function drawDonut(cx,cy){
  const x = cx*CELL + CELL/2;
  const y = cy*CELL + CELL/2;
  ctx.beginPath();
  ctx.arc(x,y,CELL*0.45,0,Math.PI*2);
  ctx.fill();
  // hole
  ctx.fillStyle = theme.board;
  ctx.beginPath(); ctx.arc(x,y,CELL*0.18,0,Math.PI*2); ctx.fill();
  // sprinkles
  ctx.fillStyle = theme.power;
  for(let i=0;i<6;i++){
    const a = Math.random()*Math.PI*2;
    ctx.fillRect(x + Math.cos(a)*CELL*0.30, y + Math.sin(a)*CELL*0.30, 3, 3);
  }
}

function drawEspresso(cx,cy){
  const x = cx*CELL, y = cy*CELL;
  ctx.save();
  ctx.translate(x+CELL/2,y+CELL/2);
  ctx.fillStyle = '#f6ce2f';
  ctx.fillRect(-6,0,12,6); // saucer
  ctx.fillStyle = '#fff';
  ctx.fillRect(-8,-6,16,10);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(10,-1,4,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawUmbrella(cx,cy){
  const x = cx*CELL + CELL/2, y = cy*CELL + CELL/2;
  ctx.save();
  ctx.strokeStyle = '#8ad1ff';
  ctx.fillStyle = '#8ad1ff';
  ctx.beginPath(); ctx.moveTo(x-8,y); ctx.quadraticCurveTo(x,y-10,x+8,y); ctx.lineTo(x-8,y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+10); ctx.stroke();
  ctx.restore();
}

function drawTurkey(cx,cy){
  const x = cx*CELL + CELL/2, y = cy*CELL + CELL/2;
  ctx.save();
  ctx.fillStyle = '#d99c6b';
  ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffd384';
  ctx.fillRect(x-6,y+3,12,4);
  ctx.restore();
}

function flash(color){
  const overlay = document.createElement('div');
  overlay.style.position='absolute';
  overlay.style.left=canvas.offsetLeft+'px';
  overlay.style.top=canvas.offsetTop+'px';
  overlay.style.width=canvas.width+'px';
  overlay.style.height=canvas.height+'px';
  overlay.style.borderRadius='16px';
  overlay.style.pointerEvents='none';
  overlay.style.background=color;
  overlay.style.opacity='0.18';
  document.body.appendChild(overlay);
  setTimeout(()=>overlay.remove(), 120);
}

// Start audio on first interaction (mobile gesture requirement)
['keydown','pointerdown'].forEach(ev=>document.addEventListener(ev, ()=>{
  if (!audio.ctx) setupAudio();
},{once:true}));
