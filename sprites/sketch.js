// Спрайти та спрайтшіти в p5.js
// Варіант А: спрайтшіт малюється прямо в коді (p5.Graphics), без зовнішніх файлів.
// Варіант B: власний PNG-спрайтшіт hero.png, завантажений у preload().
// Обидва аркуші мають однакову розкладку: кадр 32×32, рядок = анімація.
//
// Керування:
//   1 / 2 / 3       — стояти / крокувати / бігти
//   Пробіл          — стрибок
//   ← ↑ → ↓         — рух (← → також розвертають персонажа)
//   F або кнопка    — Flip (дзеркало по X)
//   - / +           — масштаб (те саме, що слайдер)
//   S               — джерело: код ↔ PNG
//   H               — показати / сховати hitbox

const FW = 32, FH = 32;          // розмір кадру в аркуші, px

// Анімації: рядок в аркуші, кількість кадрів, FPS, швидкість руху, hitbox (у пікселях кадру)
const ANIMS = {
  idle: { row: 0, frames: 4, fps: 4,  speed: 0,   label: 'Стоїть',   hit: { w: 14, h: 22, oy: 3 } },
  walk: { row: 1, frames: 6, fps: 11, speed: 110, label: 'Крокує',   hit: { w: 16, h: 22, oy: 3 } },
  run:  { row: 2, frames: 6, fps: 15, speed: 220, label: 'Біжить',   hit: { w: 18, h: 21, oy: 3 } },
  jump: { row: 3, frames: 4, fps: 8,  speed: 0,   label: 'Стрибок',  hit: { w: 14, h: 20, oy: 1 } },
};

const JUMP_TIME = 0.5;           // тривалість стрибка, с
const JUMP_HEIGHT = 18;          // висота стрибка в пікселях кадру (множиться на масштаб)

let pngSheet;                    // Варіант B
let codeSheet;                   // Варіант А
let usePng = true;

let mode = 'walk';               // обрана анімація (1/2/3)
let jumpT = -1;                  // час від початку стрибка; -1 = не стрибає
let frameIndex = 0;
let frameAcc = 0;                // накопичений час для зміни кадру, мс
let facing = 1;                  // 1 = вправо, -1 = вліво
let x, y;
let showHit = true;

let coins = [];
let score = 0;

let scaleSlider, flipBtn, srcBtn, modeBtns = {};

function preload() {
  // Варіант B: PNG із прозорістю (власний піксель-арт, 192×128, 4 рядки кадрів)
  pngSheet = loadImage('hero.png');
}

function setup() {
  const c = createCanvas(720, 420);
  if (document.getElementById('stage')) c.parent('stage');
  noSmooth();                    // піксель-арт без розмиття при збільшенні
  textFont('sans-serif');
  codeSheet = buildCodeSheet();
  x = width / 2;
  y = height / 2 + 40;

  // ---- UI (DOM): кнопки та слайдер мають фокус через Tab і Enter/Space ----
  const ui = document.getElementById('ui');
  const add = (el) => { if (ui) el.parent(ui); return el; };

  for (const [key, name] of [['1', 'idle'], ['2', 'walk'], ['3', 'run']]) {
    modeBtns[name] = add(createButton(key + ' — ' + ANIMS[name].label));
    modeBtns[name].mousePressed(() => setMode(name));
  }
  flipBtn = add(createButton('Flip (F)'));
  flipBtn.mousePressed(() => facing *= -1);
  srcBtn = add(createButton(''));
  srcBtn.mousePressed(toggleSource);

  const label = add(createSpan('Масштаб (− / +)'));
  label.addClass('lbl');
  scaleSlider = add(createSlider(1, 6, 3, 0.5));
  scaleSlider.attribute('aria-label', 'Масштаб спрайта');

  updateButtons();
  for (let i = 0; i < 3; i++) coins.push(newCoin());
}

function draw() {
  background(238, 242, 247);
  drawGround();

  const dt = min(deltaTime, 50) / 1000;
  const k = scaleSlider.value();

  // ---- рух ----
  const anim = currentAnim();
  let dx = 0, dy = 0;
  if (!typing()) {
    if (keyIsDown(LEFT_ARROW))  { dx -= 1; facing = -1; }
    if (keyIsDown(RIGHT_ARROW)) { dx += 1; facing = 1; }
    if (keyIsDown(UP_ARROW))    dy -= 1;
    if (keyIsDown(DOWN_ARROW))  dy += 1;
  }
  const moveSpeed = jumpT >= 0 ? ANIMS[mode].speed : anim.speed;
  if ((dx || dy) && moveSpeed > 0) {
    const l = Math.hypot(dx, dy);
    x += dx / l * moveSpeed * dt;
    y += dy / l * moveSpeed * dt;
  }
  const halfW = FW * k / 2, halfH = FH * k / 2;
  x = constrain(x, halfW, width - halfW);
  y = constrain(y, 70 + halfH, height - halfH);

  // ---- стрибок ----
  let lift = 0;
  if (jumpT >= 0) {
    jumpT += dt;
    const p = jumpT / JUMP_TIME;
    if (p >= 1) { jumpT = -1; setFrame(0); }
    else lift = sin(p * PI) * JUMP_HEIGHT * k;
  }

  // ---- зміна кадру за власним FPS анімації (не залежить від частоти екрана) ----
  const a = currentAnim();
  if (jumpT >= 0) {
    frameIndex = min(a.frames - 1, floor(jumpT / JUMP_TIME * a.frames));
  } else {
    frameAcc += deltaTime;
    const step = 1000 / a.fps;
    while (frameAcc >= step) {
      frameAcc -= step;
      frameIndex = (frameIndex + 1) % a.frames;
    }
  }

  // ---- малювання кадру: 9-аргументний image() вирізає кадр з аркуша ----
  const sheet = usePng ? pngSheet : codeSheet;
  const sx = frameIndex * FW, sy = a.row * FH;
  const dw = FW * k, dh = FH * k;
  const cy = y - lift;

  // тінь на землі
  noStroke();
  fill(0, 0, 0, 40 - lift / k);
  ellipse(x, y + dh * 0.42, dw * 0.55 * (1 - lift / (JUMP_HEIGHT * k * 2.5)), dh * 0.1);

  push();
  translate(x, cy);
  scale(facing, 1);              // фліп по X навколо центру
  image(sheet, -dw / 2, -dh / 2, dw, dh, sx, sy, FW, FH);
  pop();

  // ---- hitbox: прямокутник, свій для кожної анімації ----
  const hb = hitbox(a, k, cy);
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (circleRect(c.x, c.y, c.r, hb)) {
      score++;
      coins.splice(i, 1);
      coins.push(newCoin());
    }
  }
  drawCoins();
  if (showHit) {
    noFill();
    stroke(220, 40, 40);
    strokeWeight(2);
    rect(hb.x, hb.y, hb.w, hb.h);
  }

  drawHud(a, k);
}

// ---------- анімації ----------

function currentAnim() {
  return jumpT >= 0 ? ANIMS.jump : ANIMS[mode];
}

function setMode(name) {
  if (mode === name) return;
  mode = name;
  if (jumpT < 0) setFrame(0);
  updateButtons();
}

function setFrame(i) {
  frameIndex = i;
  frameAcc = 0;
}

function startJump() {
  if (jumpT >= 0) return;
  jumpT = 0;
  setFrame(0);
}

function hitbox(a, k, cy) {
  // Hitbox менший за кадр 32×32: лише тіло без прозорих полів, хвоста й вух
  const w = a.hit.w * k, h = a.hit.h * k;
  return { x: x - w / 2, y: cy - h / 2 + a.hit.oy * k, w, h };
}

// ---------- Варіант А: спрайтшіт у коді ----------

function buildCodeSheet() {
  const maxFrames = max(Object.values(ANIMS).map(a => a.frames));
  const g = createGraphics(maxFrames * FW, Object.keys(ANIMS).length * FH);
  g.pixelDensity(1);
  g.noSmooth();
  g.clear();
  for (const a of Object.values(ANIMS)) {
    for (let f = 0; f < a.frames; f++) {
      drawRobotFrame(g, f * FW, a.row * FH, a, f);
    }
  }
  return g;
}

function drawRobotFrame(g, ox, oy, a, f) {
  const t = f / a.frames * TWO_PI;
  let bob = 0, legA = 0, legB = 0, arm = 0, armsUp = false, legLen = 6, lean = 0;
  if (a === ANIMS.idle) { bob = f < 2 ? 0 : 1; arm = f < 2 ? 0 : 1; }
  if (a === ANIMS.walk) { legA = round(3 * sin(t)); legB = -legA; arm = round(-3 * sin(t)); bob = round(abs(cos(t))); }
  if (a === ANIMS.run)  { legA = round(5 * sin(t)); legB = -legA; arm = round(-6 * sin(t)); bob = round(2 * abs(cos(t))) - 1; lean = 1; }
  if (a === ANIMS.jump) { [bob, legLen, armsUp] = [[3, 3, false], [-2, 4, true], [-3, 3, true], [1, 5, false]][f]; }

  const bx = ox + 9 + lean, by = oy + 8 + bob;
  g.push();
  // ноги
  g.stroke(40, 60, 110); g.strokeWeight(3); g.strokeCap(SQUARE);
  g.line(bx + 4 + legA, by + 15, bx + 4 + legA, by + 15 + legLen);
  g.line(bx + 10 + legB, by + 15, bx + 10 + legB, by + 15 + legLen);
  // тіло
  g.noStroke();
  g.fill(40, 60, 110);
  g.rect(bx - 1, by - 1, 16, 17, 4);
  g.fill(a === ANIMS.run ? color(80, 170, 255) : color(70, 140, 235));
  g.rect(bx, by, 14, 15, 3);
  // антена
  g.stroke(40, 60, 110); g.strokeWeight(2);
  g.line(bx + 4, by - 1, bx + 4, by - 4);
  g.noStroke(); g.fill(255, 200, 40); g.rect(bx + 3, by - 6, 3, 3);
  // око-візор (дивиться вправо)
  g.fill(20, 30, 50); g.rect(bx + 7, by + 3, 7, 4, 1);
  g.fill(120, 255, 220); g.rect(bx + 11, by + 4, 2, 2);
  // рука
  g.stroke(255); g.strokeWeight(2);
  if (armsUp) g.line(bx + 9, by + 6, bx + 13, by - 2);
  else g.line(bx + 7, by + 8, bx + 7 + arm * 0.5, by + 13 + abs(arm) * 0.2);
  g.pop();
}

// ---------- Варіант B / перемикання ----------

function toggleSource() {
  usePng = !usePng;
  updateButtons();
}

function updateButtons() {
  srcBtn.html('Джерело: ' + (usePng ? 'PNG (B)' : 'код (A)') + ' — S');
  for (const [name, b] of Object.entries(modeBtns)) {
    b.attribute('aria-pressed', String(name === mode));
    if (name === mode) b.addClass('on'); else b.removeClass('on');
  }
}

// ---------- монети (щоб hitbox мав сенс) ----------

function newCoin() {
  return { x: random(40, width - 40), y: random(110, height - 40), r: 9 };
}

function drawCoins() {
  for (const c of coins) {
    stroke(180, 120, 20); strokeWeight(2);
    fill(250, 200, 60);
    circle(c.x, c.y, c.r * 2);
  }
}

function circleRect(cx, cy, r, b) {
  const nx = constrain(cx, b.x, b.x + b.w);
  const ny = constrain(cy, b.y, b.y + b.h);
  return dist(cx, cy, nx, ny) < r;
}

// ---------- фон і HUD ----------

function drawGround() {
  noStroke();
  fill(225, 232, 240);
  rect(0, 70, width, height - 70);
  stroke(210, 218, 228); strokeWeight(1);
  for (let gx = 0; gx < width; gx += 40) line(gx, 70, gx, height);
  for (let gy = 70; gy < height; gy += 40) line(0, gy, width, gy);
}

function drawHud(a, k) {
  noStroke();
  fill(250);
  rect(0, 0, width, 70);
  fill(30);
  textSize(15);
  textAlign(LEFT, TOP);
  text('Анімація: ' + a.label + '   Кадр: ' + (frameIndex + 1) + '/' + a.frames +
       '   FPS анімації: ' + (jumpT >= 0 ? round(a.frames / JUMP_TIME) : a.fps), 14, 12);
  text('Напрям: ' + (facing === 1 ? 'вправо' : 'вліво') + '   Масштаб: ×' + k +
       '   Hitbox: ' + a.hit.w + '×' + a.hit.h + ' px кадру   Монети: ' + score, 14, 38);
}

// ---------- клавіатура ----------

function typing() {
  // Стрілки на сфокусованому слайдері змінюють масштаб — тоді не рухаємо персонажа
  const el = document.activeElement;
  return el && el.tagName === 'INPUT';
}

function keyPressed() {
  const el = document.activeElement;
  const onButton = el && el.tagName === 'BUTTON';
  // Enter/Space на сфокусованій кнопці натискають саму кнопку — не дублюємо дію
  if (onButton && (key === ' ' || keyCode === ENTER)) return;

  if (key === '1') setMode('idle');
  else if (key === '2') setMode('walk');
  else if (key === '3') setMode('run');
  else if (key === ' ') { startJump(); return false; }
  else if (key === 'f' || key === 'F') facing *= -1;
  else if (key === 's' || key === 'S') toggleSource();
  else if (key === 'h' || key === 'H') showHit = !showHit;
  else if (key === '-' || key === '_') scaleSlider.value(max(1, scaleSlider.value() - 0.5));
  else if (key === '+' || key === '=') scaleSlider.value(min(6, scaleSlider.value() + 0.5));

  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode) && !typing()) return false;
}
