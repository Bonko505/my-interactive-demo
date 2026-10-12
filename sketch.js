// Гра-клацалка на p5.js
// Петля взаємодії: клік/клавіша (input) → зміна стану (processing) → реакція на екрані (feedback)

const GAME_TIME = 30;          // тривалість раунду, секунд
const BEST_KEY = 'clicker-best'; // ключ для збереження рекорду

// Стан гри: 'idle' (старт), 'playing', 'paused', 'over'
let state = 'idle';
let score = 0;
let best = 0;
let timeLeft = GAME_TIME;      // скільки секунд залишилось
let lastMillis = 0;            // для відліку часу між кадрами
let newRecord = false;

// Мішень
let target = { x: 0, y: 0, r: 40 };

// Візуальні ефекти: кільця при влучанні і "+1"
let effects = [];

function setup() {
  createCanvas(600, 400);
  textFont('sans-serif');
  best = loadBest();
  moveTarget();
}

function draw() {
  background(245);

  // Відлік часу тільки під час гри
  if (state === 'playing') {
    const now = millis();
    timeLeft -= (now - lastMillis) / 1000;
    lastMillis = now;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame();
    }
  }

  drawHUD();

  if (state === 'playing') {
    drawTarget();
  } else if (state === 'paused') {
    drawTarget();
    drawOverlay('ПАУЗА', 'SPACE — продовжити');
  } else if (state === 'idle') {
    drawOverlay('ГРА-КЛАЦАЛКА', 'Клікай по мішені: +1 бал\nSPACE — старт / стоп');
  } else if (state === 'over') {
    const title = newRecord ? 'НОВИЙ РЕКОРД!' : 'ЧАС ВИЙШОВ';
    drawOverlay(title, 'Твій результат: ' + score + '\nSPACE — грати ще раз');
  }

  drawEffects();
}

// ---------- Малювання ----------

function drawHUD() {
  noStroke();
  fill(40);
  textSize(20);
  textAlign(LEFT, TOP);
  text('Бали: ' + score, 16, 14);

  textAlign(CENTER, TOP);
  // Останні 5 секунд таймер стає червоним
  fill(timeLeft <= 5 && state === 'playing' ? color(220, 40, 40) : 40);
  text('Час: ' + ceil(timeLeft), width / 2, 14);

  fill(40);
  textAlign(RIGHT, TOP);
  text('Рекорд: ' + best, width - 16, 14);

  // Смужка часу
  const w = map(timeLeft, 0, GAME_TIME, 0, width);
  fill(255, 120, 60);
  rect(0, height - 6, w, 6);
}

function drawTarget() {
  // Мішень із трьох кіл; при наведенні трохи збільшується
  const hover = dist(mouseX, mouseY, target.x, target.y) < target.r;
  const r = hover ? target.r * 1.08 : target.r;
  noStroke();
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
  textSize(18);
  text(subtitle, width / 2, height / 2 + 25);
}

function drawEffects() {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= 1;
    const a = map(e.life, 0, 30, 0, 255);
    // Кільце, що розширюється
    noFill();
    stroke(220, 50, 50, a);
    strokeWeight(3);
    circle(e.x, e.y, e.size + (30 - e.life) * 3);
    // Напис +1, що підіймається
    noStroke();
    fill(30, 150, 60, a);
    textAlign(CENTER, CENTER);
    textSize(22);
    text('+1', e.x, e.y - (30 - e.life) * 1.5);
    if (e.life <= 0) effects.splice(i, 1); // прибираємо старі ефекти
  }
}

// ---------- Логіка ----------

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
  lastMillis = millis();
}

function endGame() {
  state = 'over';
  if (score > best) {
    best = score;
    newRecord = true;
    saveBest(best);
  }
}

function moveTarget() {
  // Мішень з'являється у випадковому місці, не заходячи за край і під HUD
  target.r = random(22, 42);
  target.x = random(target.r, width - target.r);
  target.y = random(50 + target.r, height - 10 - target.r);
}

// ---------- Події ----------

function mousePressed() {
  if (state !== 'playing') return;
  if (dist(mouseX, mouseY, target.x, target.y) < target.r) {
    score += 1;
    effects.push({ x: target.x, y: target.y, size: target.r * 2, life: 30 });
    moveTarget();
  }
}

function keyPressed() {
  if (key === ' ') {
    if (state === 'idle' || state === 'over') startGame();
    else if (state === 'playing') state = 'paused';
    else if (state === 'paused') resumeGame();
    return false; // щоб пробіл не прокручував сторінку
  }
}

// ---------- Найкращий результат (зберігається в браузері) ----------

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