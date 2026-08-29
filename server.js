const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const rooms = new Map();

function makeCode(){
  return Math.random().toString(36).slice(2,8).toUpperCase();
}

io.on("connection",socket=>{
  socket.on("createRoom",()=>{
    let room=makeCode();
    while(rooms.has(room)) room=makeCode();

    rooms.set(room,[socket.id]);
    socket.join(room);
    socket.room=room;

    socket.emit("roomCreated",room);
    socket.emit("waiting");
  });

  socket.on("joinRoom",room=>{
    room=String(room||"").toUpperCase().trim();
    const players=rooms.get(room);

    if(!players) return socket.emit("roomError","Sala não encontrada.");
    if(players.length>=2) return socket.emit("roomError","Sala cheia.");

    players.push(socket.id);
    socket.join(room);
    socket.room=room;

    io.to(players[0]).emit("startGame",{room,role:1});
    io.to(players[1]).emit("startGame",{room,role:2});
  });

  socket.on("state",data=>{
    if(!socket.room || data.room!==socket.room) return;
    socket.to(socket.room).emit("state",{id:socket.id,...data});
  });

  socket.on("hit",(room,damage)=>{
    if(socket.room!==room) return;
    socket.to(room).emit("hit",Math.min(20,Number(damage)||10));
  });

  socket.on("disconnect",()=>{
    const room=socket.room;
    if(!room || !rooms.has(room)) return;

    const next=rooms.get(room).filter(id=>id!==socket.id);

    if(next.length) {
      rooms.set(room,next);
      socket.to(room).emit("left");
    } else {
      rooms.delete(room);
    }
  });
});

app.get("/",(req,res)=>res.sendFile(__dirname+"/index.html"));

server.listen(3000,()=>console.log("Brawlzinho: http://localhost:3000"));
