const $ = s => document.querySelector(s);
const socket = (typeof io !== "undefined") ? io() : null;

const canvas = $("#gameCanvas");
const ctx = canvas.getContext("2d");

// PNGs NA MESMA PASTA
const imgAzul = new Image();
imgAzul.src = "azul.png";

const imgVerde = new Image();
imgVerde.src = "verde.png";

const imgSalatiel = new Image();
imgSalatiel.src = "azul.png";

const imgJoao = new Image();
imgJoao.src = "verde.png";

const imgJose = new Image();
imgJose.src = "jose.png";

let mode = "solo";
let room = "";
let role = 1;
let playing = false;

let timer = 240;
let timerId;
let lastAttack = 0;

const keys = {};

const MAX_HP = 1000;

// SISTEMA DE SALVAMENTO DE MOEDAS E PERSONAGENS DESBLOQUEADOS
let coins = Number(localStorage.getItem("brawlCoins")) || 0;
let unlocked = JSON.parse(localStorage.getItem("brawlUnlocked")) || [true, false, false];

function saveProgress() {
  localStorage.setItem("brawlCoins", coins);
  localStorage.setItem("brawlUnlocked", JSON.stringify(unlocked));
}

function updateCoinsUI() {
  const coinsEl = $("#playerCoins");
  if (coinsEl) coinsEl.textContent = coins;
}

const me = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  hp: MAX_HP,
  attack: 0,
  power: 0,
  super: 0,
  hitEffect: 0
};

const enemy = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  hp: MAX_HP,
  attack: 0,
  power: 0,
  super: 0,
  hitEffect: 0
};

const particles = [];

// LISTA DE PERSONAGENS COM OS VALORES E IMAGENS
const chars = [
  { name: "Salatiel", color: "#3b82f6", speed: 6, damage: 20, price: 0, image: imgSalatiel },
  { name: "João", color: "#22c55e", speed: 8, damage: 20, price: 160, image: imgJoao },
  { name: "José", color: "#f59e0b", speed: 5, damage: 40, price: 350, image: imgJose, width: 5000, height: 5000 }
];

let selected = 0;

function screen(id) {
  ["menu", "room", "how", "fighterSelect"].forEach(x => {
    const el = $("#" + x);
    if (el) el.classList.add("hidden");
  });

  if (id !== "game") {
    const el = $("#" + id);
    if (el) el.classList.remove("hidden");
  }
}

function resize() {
  canvas.width = 1000;
  canvas.height = 560;
}

addEventListener("resize", resize);
resize();

function showMessage(text) {
  const el = $("#message");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
  }, 2500);
}

function renderFighters() {
  const container = $("#fighterCards");
  if (!container) return;

  container.innerHTML = "";
  updateCoinsUI();

  chars.forEach((fighter, index) => {
    const card = document.createElement("div");
    card.className = "fighter-card" + (selected === index ? " selected" : "");

    let imageHTML = "";
    if (fighter.image && fighter.image.complete && fighter.image.naturalWidth > 0) {
      imageHTML = `<img src="${fighter.image.src}" alt="${fighter.name}" style="width: 80px; height: 120px; object-fit: contain;">`;
    } else {
      imageHTML = `<div style="background:${fighter.color}; width:80px; height:120px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold;">${fighter.name.charAt(0)}</div>`;
    }

    if (unlocked[index]) {
      card.innerHTML = `
        ${imageHTML}
        <h2>${fighter.name}</h2>
        <p>⚔️ DANO: ${fighter.damage}</p>
        <p>💨 VELOCIDADE: ${fighter.speed}</p>
        <button class="fighterChoose" data-index="${index}">
          ${selected === index ? "SELECIONADO" : "ESCOLHER"}
        </button>
      `;
    } else {
      card.innerHTML = `
        ${imageHTML}
        <h2>${fighter.name}</h2>
        <p>⚔️ DANO: ${fighter.damage}</p>
        <p>💨 VELOCIDADE: ${fighter.speed}</p>
        <p>💰 PREÇO: ${fighter.price} MOEDAS</p>
        <button class="fighterBuy" data-index="${index}">
          COMPRAR
        </button>
      `;
    }

    container.appendChild(card);
  });

  document.querySelectorAll(".fighterChoose").forEach(button => {
    button.onclick = () => {
      selected = Number(button.dataset.index);
      renderFighters();
    };
  });

  document.querySelectorAll(".fighterBuy").forEach(button => {
    button.onclick = () => {
      const index = Number(button.dataset.index);
      const fighter = chars[index];

      if (coins >= fighter.price) {
        coins -= fighter.price;
        unlocked[index] = true;
        saveProgress();
        showMessage("🎉 " + fighter.name + " DESBLOQUEADO!");
        renderFighters();
      } else {
        showMessage("❌ MOEDAS INSUFICIENTES!");
      }
    };
  });
}

function reset() {
  me.x = 150;
  me.y = canvas.height - 170;
  me.vx = 0;
  me.vy = 0;
  me.hp = MAX_HP;
  me.attack = 0;
  me.power = 0;
  me.super = 0;
  me.hitEffect = 0;

  enemy.x = canvas.width - 210;
  enemy.y = canvas.height - 170;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.hp = MAX_HP;
  enemy.attack = 0;
  enemy.power = 0;
  enemy.super = 0;
  enemy.hitEffect = 0;

  particles.length = 0;

  if ($("#p1Hp")) $("#p1Hp").style.width = "100%";
  if ($("#p2Hp")) $("#p2Hp").style.width = "100%";
  if ($("#gameOver")) $("#gameOver").classList.add("hidden");
}

function startGame(gameMode) {
  mode = gameMode;
  playing = true;

  if ($("#menu")) $("#menu").classList.add("hidden");
  if ($("#room")) $("#room").classList.add("hidden");
  if ($("#fighterSelect")) $("#fighterSelect").classList.add("hidden");
  if ($("#game")) $("#game").classList.remove("hidden");

  reset();

  timer = 240;
  if ($("#timer")) $("#timer").textContent = timer;

  clearInterval(timerId);

  timerId = setInterval(() => {
    if (!playing) return;
    timer--;
    if ($("#timer")) $("#timer").textContent = timer;

    if (timer <= 0) {
      if (me.hp > enemy.hp) {
        finish("VOCÊ VENCEU!");
      } else if (enemy.hp > me.hp) {
        finish("VOCÊ PERDEU!");
      } else {
        finish("EMPATE!");
      }
    }
  }, 1000);

  if ($("#p1Name")) {
    $("#p1Name").textContent =
      role === 1
        ? "P1: " + chars[selected].name
        : "P2: " + chars[selected].name;
  }

  if ($("#p2Name")) {
    $("#p2Name").textContent =
      role === 1
        ? "PLAYER 2"
        : "PLAYER 1";
  }

  if ($("#role")) {
    $("#role").textContent =
      role === 1
        ? "P1"
        : "P2";
  }

  if ($("#roomLabel")) {
    $("#roomLabel").textContent =
      room
        ? "SALA " + room
        : "SOLO";
  }
}

function finish(text) {
  if (!playing) return;
  playing = false;
  clearInterval(timerId);

  if (text === "VOCÊ VENCEU!") {
    coins += 50;
    saveProgress();
    showMessage("🏆 VITÓRIA! +50 MOEDAS!");
  }

  if ($("#resultTitle")) $("#resultTitle").textContent = text;
  if ($("#gameOver")) $("#gameOver").classList.remove("hidden");
}

function createImpact(x, y, color, amount = 15) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 7;

    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: color,
      size: 3 + Math.random() * 5
    });
  }
}

function damageEnemy(damage, superAttack = false) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  me.power = Math.min(100, me.power + damage * 2);

  enemy.hitEffect = superAttack ? 25 : 12;

  createImpact(
    enemy.x + 32,
    enemy.y + 55,
    superAttack ? "#ffff00" : "#ffffff",
    superAttack ? 40 : 18
  );
}

function attack() {
  const now = performance.now();
  if (now - lastAttack < 400) return;

  lastAttack = now;
  me.attack = 12;

  const distanceX = Math.abs(me.x - enemy.x);
  const distanceY = Math.abs(me.y - enemy.y);

  if (distanceX < 120 && distanceY < 80) {
    const damage = chars[selected].damage;

    if (mode === "solo") {
      damageEnemy(damage);
    } else if (socket) {
      socket.emit("hit", room, damage);
      me.power = Math.min(100, me.power + damage * 2);

      createImpact(
        enemy.x + 32,
        enemy.y + 55,
        "#ffffff",
        18
      );
    }
  }
}

function superAttack() {
  if (me.power < 100) {
    showMessage("⚡ CARREGUE O SUPER!");
    return;
  }

  const now = performance.now();
  if (now - lastAttack < 700) return;

  lastAttack = now;
  me.power = 0;
  me.super = 45;
  me.attack = 25;

  const distance = Math.abs(me.x - enemy.x);

  if (distance < 260) {
    if (mode === "solo") {
      damageEnemy(75, true);
    } else if (socket) {
      socket.emit("hit", room, 75);
      enemy.hitEffect = 25;

      createImpact(
        enemy.x + 32,
        enemy.y + 55,
        "#ffff00",
        40
      );
    }
  }

  showMessage("⚡ SUPER PODER!");
}

function physics(p) {
  p.vy += 0.65;
  p.x += p.vx;
  p.y += p.vy;

  const floor = canvas.height - 186;

  if (p.y >= floor) {
    p.y = floor;
    p.vy = 0;
  }

  p.x = Math.max(
    30,
    Math.min(canvas.width - 90, p.x)
  );
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= 0.035;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function update() {
  me.vx = 0;

  if (keys.a) {
    me.vx = -chars[selected].speed;
  }

  if (keys.d) {
    me.vx = chars[selected].speed;
  }

  if (keys[" "] && me.y >= canvas.height - 187) {
    me.vy = -12;
    keys[" "] = false;
  }

  if (keys.f) {
    attack();
    keys.f = false;
  }

  if (keys.g) {
    superAttack();
    keys.g = false;
  }

  physics(me);

  if (mode === "solo") {
    const d = me.x - enemy.x;

    enemy.vx = Math.abs(d) > 100
      ? Math.sign(d) * 2.2
      : 0;

    physics(enemy);

    if (Math.abs(d) < 110 && Math.random() < 0.012) {
      const now = performance.now();

      if (now - lastAttack > 700) {
        lastAttack = now;
        const damage = 8;

        me.hp = Math.max(0, me.hp - damage);
        enemy.attack = 10;
        enemy.power = Math.min(100, enemy.power + damage * 2);
        me.hitEffect = 10;

        createImpact(
          me.x + 32,
          me.y + 55,
          "#ff5555",
          15
        );
      }
    }
  }

  if (mode === "online" && socket) {
    socket.emit("state", {
      room: room,
      x: me.x,
      y: me.y,
      hp: me.hp,
      attack: me.attack,
      power: me.power,
      super: me.super
    });
  }

  if (me.attack > 0) me.attack--;
  if (enemy.attack > 0) enemy.attack--;
  if (me.super > 0) me.super--;
  if (enemy.super > 0) enemy.super--;
  if (me.hitEffect > 0) me.hitEffect--;
  if (enemy.hitEffect > 0) enemy.hitEffect--;

  updateParticles();

  if (me.hp <= 0) finish("VOCÊ PERDEU!");
  if (enemy.hp <= 0) finish("VOCÊ VENCEU!");

  if ($("#p1Hp")) $("#p1Hp").style.width = ((role === 1 ? me.hp : enemy.hp) / MAX_HP * 100) + "%";
  if ($("#p2Hp")) $("#p2Hp").style.width = ((role === 1 ? enemy.hp : me.hp) / MAX_HP * 100) + "%";
}

function drawFighter(p, img, name, targetX) {
  // SOMBRA
  ctx.fillStyle = "#0005";
  ctx.beginPath();
  ctx.ellipse(
    p.x + 32,
    canvas.height - 68,
    35,
    8,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // AURA DO SUPER
  if (p.super > 0) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 80) * 0.15;
    ctx.fillStyle = "#ffff00";
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.arc(
      p.x + 32,
      p.y + 55,
      65 + Math.sin(performance.now() / 100) * 8,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  // EFEITO DE DANO
  if (p.hitEffect > 0) {
    ctx.save();
    ctx.globalAlpha = p.hitEffect / 25;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(
      p.x + 32,
      p.y + 55,
      20 + (25 - p.hitEffect) * 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  // DIREÇÃO DO ADVERSÁRIO (1 para direita, -1 para esquerda)
  const facingDir = targetX >= p.x ? 1 : -1;

  // DESENHO DO PERSONAGEM E ATAQUE COM ESPELHAMENTO
  ctx.save();
  ctx.translate(p.x + 32, p.y + 60);

  if (facingDir === -1) {
    ctx.scale(-1, 1);
  }

  if (p.attack > 0) {
    ctx.scale(1.08, 0.95);
  }

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, -32, -60, 64, 120);
  } else {
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(-32, -60, 64, 120);
  }

  // LUVA / EFEITO DE SOCO
  if (p.attack > 0) {
    const progress = 1 - p.attack / 12;
    const punchX = 23 + progress * 70;
    const punchY = -5;

    ctx.save();
    ctx.globalAlpha = Math.min(1, p.attack / 8);
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#f5f5f5";
    ctx.beginPath();
    ctx.arc(punchX, punchY, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // NOME DO PERSONAGEM
  ctx.fillStyle = "#fff";
  ctx.font = "900 13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(name, p.x + 32, p.y - 10);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPowerBars() {
  const myPower = role === 1 ? me.power : enemy.power;
  const enemyPower = role === 1 ? enemy.power : me.power;

  // FUNDO
  ctx.fillStyle = "#0009";
  ctx.fillRect(30, canvas.height - 42, 250, 16);
  ctx.fillRect(canvas.width - 280, canvas.height - 42, 250, 16);

  // BARRA PLAYER
  const gradient = ctx.createLinearGradient(30, 0, 280, 0);
  gradient.addColorStop(0, "#00ffff");
  gradient.addColorStop(1, "#0066ff");

  ctx.fillStyle = gradient;
  ctx.fillRect(30, canvas.height - 42, 250 * (myPower / 100), 16);

  // BARRA INIMIGO
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(canvas.width - 280, canvas.height - 42, 250 * (enemyPower / 100), 16);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "left";
  ctx.fillText("⚡ SUPER " + Math.floor(myPower) + "%", 30, canvas.height - 48);

  ctx.textAlign = "right";
  ctx.fillText("INIMIGO " + Math.floor(enemyPower) + "%", canvas.width - 30, canvas.height - 48);
}

function draw() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#16295f");
  g.addColorStop(1, "#55b6e8");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ESTRELAS
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = "#ffffff22";
    ctx.beginPath();
    ctx.arc(
      (i * 97) % canvas.width,
      60 + (i * 37) % 250,
      2 + i % 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // MONTANHAS
  ctx.fillStyle = "#8fc6a3";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 70);
  ctx.lineTo(170, 260);
  ctx.lineTo(350, canvas.height - 70);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(540, canvas.height - 70);
  ctx.lineTo(730, 240);
  ctx.lineTo(930, canvas.height - 70);
  ctx.fill();

  // CHÃO
  ctx.fillStyle = "#3d943f";
  ctx.fillRect(0, canvas.height - 70, canvas.width, 70);
  ctx.fillStyle = "#58b95c";
  ctx.fillRect(0, canvas.height - 70, canvas.width, 10);

  // JOGADOR
  drawFighter(
    me,
    chars[selected].image,
    role === 1 ? chars[selected].name : "Você",
    enemy.x
  );

  // INIMIGO
  drawFighter(
    enemy,
    role === 1 ? imgVerde : imgAzul,
    role === 1 ? "P2" : "P1",
    me.x
  );

  drawParticles();
  drawPowerBars();
}

function loop() {
  if (playing) {
    update();
    draw();
  }
  requestAnimationFrame(loop);
}

// TECLADO
document.addEventListener("keydown", e => {
  const key = e.key === " " ? " " : e.key.toLowerCase();
  keys[key] = true;

  if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
  }

  if (e.key === "Escape") {
    playing = false;
    clearInterval(timerId);
    if ($("#game")) $("#game").classList.add("hidden");
    screen("menu");
  }
});

document.addEventListener("keyup", e => {
  const key = e.key === " " ? " " : e.key.toLowerCase();
  keys[key] = false;
});

// BOTÕES
if ($("#soloBtn")) $("#soloBtn").onclick = () => startGame("solo");
if ($("#shopBtn")) {
  $("#shopBtn").onclick = () => {
    screen("fighterSelect");
    renderFighters();
  };
}
if ($("#backFighter")) $("#backFighter").onclick = () => screen("menu");
if ($("#onlineBtn")) $("#onlineBtn").onclick = () => screen("room");
if ($("#howBtn")) $("#howBtn").onclick = () => screen("how");
if ($("#backRoom")) $("#backRoom").onclick = () => screen("menu");
if ($("#backHow")) $("#backHow").onclick = () => screen("menu");

// SOCKET
if ($("#createBtn")) $("#createBtn").onclick = () => socket && socket.emit("createRoom");
if ($("#joinBtn")) {
  $("#joinBtn").onclick = () => {
    const code = $("#roomInput").value.trim().toUpperCase();
    if (code && socket) {
      socket.emit("joinRoom", code);
    }
  };
}

if ($("#copyBtn")) {
  $("#copyBtn").onclick = async () => {
    await navigator.clipboard.writeText(room);
    showMessage("Código copiado!");
  };
}

if ($("#againBtn")) $("#againBtn").onclick = () => startGame(mode);
if ($("#gameMenuBtn")) {
  $("#gameMenuBtn").onclick = () => {
    playing = false;
    clearInterval(timerId);
    if ($("#game")) $("#game").classList.add("hidden");
    screen("menu");
  };
}

if (socket) {
  socket.on("roomCreated", code => {
    room = code;
    role = 1;
    if ($("#roomCode")) $("#roomCode").textContent = code;
    if ($("#codeBox")) $("#codeBox").classList.remove("hidden");
    if ($("#roomStatus")) $("#roomStatus").textContent = "Sala criada! Envie este código ao seu amigo.";
  });

  socket.on("waiting", () => {
    if ($("#roomStatus")) $("#roomStatus").textContent = "Aguardando o segundo jogador...";
  });

  socket.on("roomError", msg => {
    if ($("#roomStatus")) $("#roomStatus").textContent = msg;
  });

  socket.on("startGame", data => {
    room = data.room;
    role = data.role;
    startGame("online");
    showMessage("Partida iniciada!");
  });

  socket.on("state", data => {
    if (data.id === socket.id) return;

    enemy.x = data.x;
    enemy.hp = data.hp;
    enemy.attack = data.attack || 0;
    enemy.power = data.power || 0;
    enemy.super = data.super || 0;
    enemy.y = canvas.height - 186;
  });

  socket.on("left", () => {
    if (playing) {
      showMessage("⚠️ O outro jogador saiu.");
    }
  });
}

// LOADING
window.addEventListener("load", () => {
  setTimeout(() => {
    if ($("#loading")) {
      $("#loading").classList.remove("active");
      $("#loading").classList.add("hidden");
    }
    if ($("#menu")) $("#menu").classList.remove("hidden");
  }, 1000);
});

// CONTROLES MOBILE
document.querySelectorAll("#mobileControls button").forEach(button => {
  const key = button.dataset.key;

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    keys[key] = true;
  });

  button.addEventListener("pointerup", e => {
    e.preventDefault();
    keys[key] = false;
  });

  button.addEventListener("pointercancel", () => {
    keys[key] = false;
  });

  button.addEventListener("pointerleave", () => {
    keys[key] = false;
  });
});

loop();
