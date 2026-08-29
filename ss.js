const $ = s => document.querySelector(s);
const socket = io();

const canvas = $("#gameCanvas");
const ctx = canvas.getContext("2d");

let mode = "solo", room = "", role = 1, playing = false;
let timer = 60, timerId, lastAttack = 0;
const keys = {};

const me = { x:0, y:0, vx:0, vy:0, hp:100, attack:0 };
const enemy = { x:0, y:0, hp:100, attack:0 };

const chars = [
  {name:"Zeca",color:"#3b82f6",speed:6,damage:12,icon:"😎"},
  {name:"Nina",color:"#ec4899",speed:8,damage:9,icon:"🧢"},
  {name:"Robo",color:"#64748b",speed:4,damage:16,icon:"🤖"},
  {name:"Gato",color:"#f59e0b",speed:10,damage:8,icon:"🐱"}
];

let selected = 0;

function screen(id){
  ["menu","room","how"].forEach(x => $("#"+x).classList.add("hidden"));
  if(id !== "game") $("#"+id).classList.remove("hidden");
}

function resize(){
  canvas.width = 1000;
  canvas.height = 560;
}

addEventListener("resize",resize);
resize();

function showMessage(text){
  const el = $("#message");
  el.textContent = text;
  el.classList.remove("hidden");
  setTimeout(()=>el.classList.add("hidden"),2500);
}

function reset(){
  me.x = 150; me.y = canvas.height-170; me.vx = 0; me.vy = 0; me.hp = 100; me.attack = 0;
  enemy.x = canvas.width-210; enemy.y = canvas.height-170; enemy.vx = 0; enemy.vy = 0; enemy.hp = 100; enemy.attack = 0;
  $("#p1Hp").style.width = "100%";
  $("#p2Hp").style.width = "100%";
  $("#gameOver").classList.add("hidden");
}

function startGame(gameMode){
  mode = gameMode;
  playing = true;
  $("#menu").classList.add("hidden");
  $("#room").classList.add("hidden");
  $("#game").classList.remove("hidden");
  reset();
  timer = 60;
  $("#timer").textContent = timer;
  clearInterval(timerId);
  timerId = setInterval(()=>{
    if(!playing)return;
    $("#timer").textContent = --timer;
    if(timer <= 0) finish("EMPATE!");
  },1000);

  $("#p1Name").textContent = role===1 ? "P1: "+chars[selected].name : "P2: "+chars[selected].name;
  $("#p2Name").textContent = role===1 ? "PLAYER 2" : "PLAYER 1";
  $("#role").textContent = role===1 ? "P1" : "P2";
  $("#roomLabel").textContent = room ? "SALA "+room : "SOLO";
}

function finish(text){
  if(!playing)return;
  playing = false;
  clearInterval(timerId);
  $("#resultTitle").textContent = text;
  $("#gameOver").classList.remove("hidden");
}

function attack(){
  const now = performance.now();
  if(now-lastAttack < 300)return;
  lastAttack = now;
  me.attack = 8;

  if(Math.abs(me.x-enemy.x) < 100 && Math.abs(me.y-enemy.y) < 60){
    if(mode === "solo"){
      enemy.hp = Math.max(0,enemy.hp-10);
    }else{
      socket.emit("hit",room,10);
    }
  }
}

function physics(p){

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
    Math.min(
      canvas.width - 90,
      p.x
    )
  );
}

function update(){
  me.vx = 0;
  if(keys.a) me.vx = -chars[selected].speed;
  if(keys.d) me.vx = chars[selected].speed;
  if(keys[" "] && me.y >= canvas.height-171){me.vy=-12;keys[" "]=false}
  if(keys.f || keys.g){attack();keys.f=false;keys.g=false}
  physics(me);

  if(mode === "solo"){
    const d = me.x-enemy.x;
    enemy.vx = Math.abs(d)>90 ? Math.sign(d)*2.2 : 0;
    if(Math.abs(d)<100 && Math.random()<.03) enemy.hp = Math.max(0,enemy.hp-0);
    physics(enemy);
    if(Math.abs(d)<100 && Math.random()<.02){
      const now = performance.now();
      if(now-lastAttack>500){lastAttack=now;me.hp=Math.max(0,me.hp-8)}
    }
  }

  if(mode === "online"){
    socket.emit("state",{room,x:me.x,y:me.y,hp:me.hp,attack:me.attack});
  }

  me.attack && me.attack--;
  enemy.attack && enemy.attack--;

  if(me.hp<=0)finish("VOCÊ PERDEU!");
  if(enemy.hp<=0)finish("VOCÊ VENCEU!");

  $("#p1Hp").style.width = (role===1?me.hp:enemy.hp)+"%";
  $("#p2Hp").style.width = (role===1?enemy.hp:me.hp)+"%";
}

function drawFighter(p,color,name,face){
  ctx.fillStyle="#0005";
  ctx.beginPath();ctx.ellipse(p.x+28,canvas.height-68,35,8,0,0,Math.PI*2);ctx.fill();

  ctx.fillStyle="#ffd1b3";
  ctx.beginPath();ctx.arc(p.x+28,p.y+22,23,0,Math.PI*2);ctx.fill();

  ctx.fillStyle="#3b2418";
  ctx.beginPath();ctx.arc(p.x+28,p.y+15,23,Math.PI,Math.PI*2);ctx.fill();

  ctx.fillStyle=color;
  ctx.beginPath();ctx.roundRect(p.x,p.y+40,56,55,14);ctx.fill();

  ctx.strokeStyle="#ffd1b3";
  ctx.lineWidth=13;
  ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(p.x+28,p.y+58);
  ctx.lineTo(p.x+28+(p.attack?55:face*28),p.y+(p.attack?58:75));
  ctx.stroke();

  ctx.strokeStyle="#202020";
  ctx.lineWidth=14;
  ctx.beginPath();
  ctx.moveTo(p.x+18,p.y+94);ctx.lineTo(p.x+12,p.y+116);
  ctx.moveTo(p.x+38,p.y+94);ctx.lineTo(p.x+44,p.y+116);
  ctx.stroke();

  ctx.fillStyle="#fff";
  ctx.font="900 13px Nunito";
  ctx.textAlign="center";
  ctx.fillText(name,p.x+28,p.y-10);
}

function draw(){
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,"#16295f");
  g.addColorStop(1,"#55b6e8");
  ctx.fillStyle=g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  for(let i=0;i<18;i++){
    ctx.fillStyle="#ffffff22";
    ctx.beginPath();
    ctx.arc((i*97)%canvas.width,60+(i*37)%250,2+i%3,0,Math.PI*2);
    ctx.fill();
  }

  ctx.fillStyle="#8fc6a3";
  ctx.beginPath();ctx.moveTo(0,canvas.height-70);ctx.lineTo(170,260);ctx.lineTo(350,canvas.height-70);ctx.fill();
  ctx.beginPath();ctx.moveTo(540,canvas.height-70);ctx.lineTo(730,240);ctx.lineTo(930,canvas.height-70);ctx.fill();

  ctx.fillStyle="#3d943f";ctx.fillRect(0,canvas.height-70,canvas.width,70);
  ctx.fillStyle="#58b95c";ctx.fillRect(0,canvas.height-70,canvas.width,10);

  drawFighter(me,role===1?chars[selected].color:"#6ee7ff",role===1?chars[selected].name:"Você",role===1?1:-1);
  drawFighter(enemy,role===1?"#6ee7ff":chars[selected].color,role===1?"P2":"P1",role===1?-1:1);
}

function loop(){
  if(playing){update();draw()}
  requestAnimationFrame(loop);
}

document.addEventListener("keydown",e=>{
  const key = e.key === " " ? " " : e.key.toLowerCase();
  keys[key] = true;
  if(e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
  }
  if(e.key==="Escape"){
    playing=false;
    clearInterval(timerId);
    $("#game").classList.add("hidden");
    screen("menu");
  }
});
document.addEventListener("keyup",e=>{
  const key = e.key === " " ? " " : e.key.toLowerCase();
  keys[key] = false;
});

$("#soloBtn").onclick=()=>startGame("solo");
$("#onlineBtn").onclick=()=>screen("room");
$("#howBtn").onclick=()=>screen("how");
$("#backRoom").onclick=()=>screen("menu");
$("#backHow").onclick=()=>screen("menu");

$("#createBtn").onclick=()=>socket.emit("createRoom");
$("#joinBtn").onclick=()=>{
  const code=$("#roomInput").value.trim().toUpperCase();
  if(code)socket.emit("joinRoom",code);
};
$("#copyBtn").onclick=async()=>{
  await navigator.clipboard.writeText(room);
  showMessage("Código copiado!");
};

$("#againBtn").onclick=()=>startGame(mode);
$("#gameMenuBtn").onclick=()=>{
  playing=false;
  clearInterval(timerId);
  $("#game").classList.add("hidden");
  screen("menu");
};

socket.on("roomCreated",code=>{
  room=code;
  role=1;
  $("#roomCode").textContent=code;
  $("#codeBox").classList.remove("hidden");
  $("#roomStatus").textContent="Sala criada! Envie este código ao seu amigo.";
});

socket.on("waiting",()=>{
  $("#roomStatus").textContent="Aguardando o segundo jogador...";
});

socket.on("roomError",msg=>{
  $("#roomStatus").textContent=msg;
});

socket.on("startGame",data=>{
  room=data.room;
  role=data.role;
  startGame("online");
  showMessage("Partida iniciada!");
});

socket.on("state", data => {

  if(data.id === socket.id) return;

  enemy.x = data.x;
  enemy.hp = data.hp;
  enemy.attack = data.attack;

  enemy.y = canvas.height - 186;
});
socket.on("left",()=>{
  if(playing)showMessage("⚠️ O outro jogador saiu.");
});

window.addEventListener("load",()=>{
  setTimeout(()=>{
    $("#loading").classList.remove("active");
    $("#loading").classList.add("hidden");
    $("#menu").classList.remove("hidden");
  },10000);
});

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