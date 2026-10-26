// Гра-клацалка на p5.js
// Петля взаємодії: клік/клавіша (input) → зміна стану (processing) → реакція на екрані (feedback)
//
// Керування:
//   клік по мішені            → +1 бал
//   перетягнути мішень у кошик → +3 бали (drag починається лише після зсуву > SLOP px)
//   стрілки ← ↑ → ↓            → рухають мішень так само, як drag (клавіатурна альтернатива)
//   SPACE                      → старт / пауза / продовжити / нова гра

const GAME_TIME = 30;            // тривалість раунду, секунд
const BEST_KEY = 'clicker-best'; // ключ для збереження рекорду
const SLOP = 8;                  // просторовий поріг drag, px
const KEY_STEP = 6;              // крок руху стрілками, px
const KEY_INTERVAL = 30;         // throttle для стрілок: не частіше ніж раз на 30 мс
const BONUS = 3;                 // бали за доставку мішені в кошик

// Стан гри: 'idle' (старт), 'playing', 'paused', 'over'
let state = 'idle';
let score = 0;
let best = 0;
let timeLeft = GAME_TIME;
let lastMillis = 0;
let newRecord = false;

// Мішень і її власний скінченний автомат (FSM):
// 'idle' → 'hover' → 'pressed' → 'dragging' → 'dropped' → 'idle'
let target = { x: 0, y: 0, r: 40 };
let targetState = 'idle';
let pressX = 0, pressY = 0;      // де натиснули (для порогу SLOP)
let grabDX = 0, grabDY = 0;      // зсув курсора від центру мішені, щоб вона не "стрибала"
let droppedAt = 0;               // час переходу в 'dropped'

let basket;                      // зона-кошик для drag & drop
let effects = [];                // візуальні ефекти

function setup() {
  const c = createCanvas(600, 400);
  if (document.getElementById('stage')) c.parent('stage'); // у editor.p5js.org цього блоку немає
  textFont('sans-serif');
  basket = { x: width - 130, y: height - 116, w: 114, h: 100 };
  best = loadBest();
  moveTarget();
}

function draw() {
  background(245);

  if (state === 'playing') {
    const now = millis();
    timeLeft -= (now - lastMillis) / 1000;
    lastMillis = now;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
    }
  }

  if (state === 'playing') updateTarget();

  drawBasket();
  drawHUD();

  if (state === 'playing') {
    drawTarget();
  } else if (state === 'paused') {
    drawTarget();
    drawOverlay('ПАУЗА', 'SPACE — продовжити');
  } else if (state === 'idle') {
    drawOverlay('ГРА-КЛАЦАЛКА',
      'Клік по мішені: +1 • Перетягни в кошик: +' + BONUS +
      '\nСтрілки рухають мішень • SPACE — старт / стоп');
  } else if (state === 'over') {
    const title = newRecord ? 'НОВИЙ РЕКОРД!' : 'ЧАС ВИЙШОВ';
    drawOverlay(title, 'Твій результат: ' + score + '\nSPACE — грати ще раз');
  }

  drawEffects();
}

// ---------- Оновлення стану мішені (вся "важка" логіка тут, а не в обробниках) ----------

function updateTarget() {
  const over = isOverTarget(mouseX, mouseY);

  if (targetState === 'idle' && over) targetState = 'hover';
  else if (targetState === 'hover' && !over) targetState = 'idle';

  // Dragging: мішень іде за курсором
  if (targetState === 'dragging' && mouseIsPressed) {
    target.x = constrain(mouseX + grabDX, target.r, width - target.r);
    target.y = constrain(mouseY + grabDY, 50 + target.r, height - 10 - target.r);
  }

  // Dropped → Idle: коротка пауза, щоб показати відгук
  if (targetState === 'dropped' && millis() - droppedAt > 150) {
    targetState = over ? 'hover' : 'idle';
  }

  // Клавіатурна альтернатива drag: стрілки (утримання працює завдяки throttle)
  if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW) ||
      keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) {
    moveByKeys();
  }

  cursor(targetState === 'dragging' ? MOVE : over ? HAND : ARROW);
}

const moveByKeys = throttle(() => {
  let dx = 0, dy = 0;
  if (keyIsDown(LEFT_ARROW))  dx -= KEY_STEP;
  if (keyIsDown(RIGHT_ARROW)) dx += KEY_STEP;
  if (keyIsDown(UP_ARROW))    dy -= KEY_STEP;
  if (keyIsDown(DOWN_ARROW))  dy += KEY_STEP;
  target.x = constrain(target.x + dx, target.r, width - target.r);
  target.y = constrain(target.y + dy, 50 + target.r, height - 10 - target.r);
  // Мішень доїхала стрілками до кошика → це той самий Drop, що й мишею
  if (inBasket()) dropTarget();
}, KEY_INTERVAL);

function dropTarget() {
  if (inBasket()) {
    score += BONUS;
    addEffect(target.x, target.y, '+' + BONUS, true);
    moveTarget();
  }
  targetState = 'dropped';
  droppedAt = millis();
}

// ---------- Малювання ----------

function drawHUD() {
  noStroke();
  fill(40);
  textSize(20);
  textAlign(LEFT, TOP);
  text('Бали: ' + score, 16, 14);

  textAlign(CENTER, TOP);
  fill(timeLeft <= 5 && state === 'playing' ? color(220, 40, 40) : 40);
  text('Час: ' + ceil(timeLeft), width / 2, 14);

  fill(40);
  textAlign(RIGHT, TOP);
  text('Рекорд: ' + best, width - 16, 14);

  const w = map(timeLeft, 0, GAME_TIME, 0, width);
  fill(255, 120, 60);
  rect(0, height - 6, w, 6);
}

function drawBasket() {
  // Під час перетягування кошик підсвічується, а коли мішень над ним — ще яскравіше
  const dragging = targetState === 'dragging' && state === 'playing';
  const hot = dragging && inBasket();
  strokeWeight(2);
  stroke(hot ? color(30, 150, 60) : dragging ? color(90, 170, 110) : color(190));
  fill(hot ? color(200, 240, 210) : dragging ? color(225, 245, 230) : color(235));
  rect(basket.x, basket.y, basket.w, basket.h, 10);
  noStroke();
  fill(hot ? color(30, 120, 50) : 120);
  textAlign(CENTER, CENTER);
  textSize(15);
  text('КОШИК\n+' + BONUS, basket.x + basket.w / 2, basket.y + basket.h / 2);
}

function drawTarget() {
  // Вигляд залежить від стану FSM
  let k = 1;
  if (targetState === 'hover') k = 1.08;
  if (targetState === 'pressed') k = 0.94;
  if (targetState === 'dragging') k = 1.15;
  const r = target.r * k;

  noStroke();
  if (targetState === 'dragging') {     // "відрив" від поверхні — тінь
    fill(0, 0, 0, 40);
    circle(target.x + 6, target.y + 8, r * 2);
  }
  fill(220, 50, 50);
  circle(target.x, target.y, r * 2);
  fill(255);
  circle(target.x, target.y, r * 1.35);
  fill(220, 50, 50);
  circle(target.x, target.y, r * 0.7);
}

function drawOverlay(title, subtitle) {
  noStroke();
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text(title, width / 2, height / 2 - 40);
  textSize(17);
  text(subtitle, width / 2, height / 2 + 28);
}

function addEffect(x, y, label, bonus) {
  effects.push({ x, y, size: target.r * 2, life: 30, label, bonus });
}

function drawEffects() {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= 1;
    const a = map(e.life, 0, 30, 0, 255);
    noFill();
    stroke(e.bonus ? color(30, 150, 60, a) : color(220, 50, 50, a));
    strokeWeight(3);
    circle(e.x, e.y, e.size + (30 - e.life) * 3);
    noStroke();
    fill(30, 150, 60, a);
    textAlign(CENTER, CENTER);
    textSize(e.bonus ? 28 : 22);
    text(e.label, e.x, e.y - (30 - e.life) * 1.5);
    if (e.life <= 0) effects.splice(i, 1);
  }
}

// ---------- Логіка гри ----------

function startGame() {
  score = 0;
  timeLeft = GAME_TIME;
  newRecord = false;
  effects = [];
  moveTarget();
  resumeGame();
}

function resumeGame() {
  state = 'playing';
  targetState = 'idle';
  lastMillis = millis();
}

function endGame() {
  state = 'over';
  targetState = 'idle';
  cursor(ARROW);
  if (score > best) {
    best = score;
    newRecord = true;
    saveBest(best);
  }
}

function moveTarget() {
  // Випадкове місце: не за краєм, не під HUD і не в кошику
  do {
    target.r = random(24, 42);
    target.x = random(target.r, width - target.r);
    target.y = random(50 + target.r, height - 10 - target.r);
  } while (target.x > basket.x - target.r - 20 && target.y > basket.y - target.r - 20);
}

function isOverTarget(x, y) {
  return dist(x, y, target.x, target.y) < target.r;
}

function inBasket() {
  return target.x > basket.x && target.x < basket.x + basket.w &&
         target.y > basket.y && target.y < basket.y + basket.h;
}

// ---------- Обробники подій: короткі, лише змінюють стан ----------

function mousePressed() {
  if (state !== 'playing' || !isOverTarget(mouseX, mouseY)) return;
  targetState = 'pressed';
  pressX = mouseX;
  pressY = mouseY;
  grabDX = target.x - mouseX;
  grabDY = target.y - mouseY;
}

function mouseDragged() {
  // Pressed → Dragging лише якщо курсор зсунувся далі за поріг
  if (targetState === 'pressed' && dist(mouseX, mouseY, pressX, pressY) > SLOP) {
    targetState = 'dragging';
  }
}

function mouseReleased() {
  if (state !== 'playing') return;
  if (targetState === 'pressed') {
    // Відпустили без перетягування → це клік: +1
    score += 1;
    addEffect(target.x, target.y, '+1', false);
    moveTarget();
    targetState = 'idle';
  } else if (targetState === 'dragging') {
    dropTarget();
  }
}

function keyPressed() {
  if (key === ' ') {
    if (state === 'idle' || state === 'over') startGame();
    else if (state === 'playing') { state = 'paused'; targetState = 'idle'; }
    else if (state === 'paused') resumeGame();
    return false; // щоб пробіл не прокручував сторінку
  }
  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
    return false; // стрілки теж не прокручують сторінку
  }
}

// ---------- Утиліти ----------

// Throttle: виконує fn не частіше ніж раз на wait мс
function throttle(fn, wait) {
  let last = -Infinity;
  return (...args) => {
    const now = millis();
    if (now - last >= wait) { last = now; fn(...args); }
  };
}

function loadBest() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, value);
  } catch (e) {
    // якщо сховище недоступне — рекорд живе до перезавантаження
  }
}
