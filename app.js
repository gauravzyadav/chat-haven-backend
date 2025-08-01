// ===============================
// ✅ BACKEND: app.js with Clerk Auth (Final)
// ===============================

require('dotenv').config(); // 🔐 Load .env variables first
const askGemini = require('./utils/gemini');
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { verifyToken } = require('@clerk/backend');
const Message = require('./models/Message');
const Room = require('./models/Room');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    // ✅ Ensure AI room exists
    const existingAI = await Room.findOne({ code: 'ai-assistant' });
    if (!existingAI) {
      await Room.create({
        code: 'ai-assistant',
        adminId: 'system',
        adminName: 'AI Bot',
      });
      console.log('🤖 AI Room "ai-assistant" created');
    }
  })
  .catch((err) => console.log('❌ MongoDB Error:', err));

// ✅ Now this comes AFTER the connection
const env_type = process.env.ENV_TYPE;
const frontend_url = env_type === 'PROD'
  ? process.env.FRONTEND_URL_DEPLOYED
  : process.env.FRONTEND_URL_LOCALHOST;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontend_url,
    methods: ['GET', 'POST'],
  },
});

const roomUsers = {}; // { roomCode: [ { id: socket.id, name: username } ] }

// 🔐 Clerk token verification middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY, // 👈 Use secret key from .env
    });
    socket.username = payload.name;
    socket.email = payload.email;
    next();
  } catch (err) {
    console.log('❌ Clerk token verification failed:', err.message);
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log(`✅ Authenticated user connected: ${socket.username}`);

  socket.on('create_room', async ({ roomCode }) => {
    const existingRoom = await Room.findOne({ code: roomCode });
    if (existingRoom) {
      socket.emit('room_exists');
      return;
    }

    await Room.create({
      code: roomCode,
      adminId: socket.id,
      adminName: socket.username,
    });

    socket.join(roomCode);
    roomUsers[roomCode] = [{ id: socket.id, name: socket.username }];
    socket.emit('room_created', { roomCode, isAdmin: true });
  });

  socket.on('join_room', async ({ roomCode }) => {
    const room = await Room.findOne({ code: roomCode });
    if (!room) {
      socket.emit('room_not_found');
      return;
    }

    socket.join(roomCode);
    if (!roomUsers[roomCode]) roomUsers[roomCode] = [];
    roomUsers[roomCode].push({ id: socket.id, name: socket.username });

    const messages = await Message.find({ room: roomCode });
    socket.emit('previous_messages', messages);

    const isAdmin = socket.id === room.adminId;
    socket.emit('joined_room', { isAdmin });

    const userList = roomUsers[roomCode].map(u => u.name);
    io.to(roomCode).emit('update_users', userList);
  });

  socket.on('send_message', async ({ message, room }) => {
    if (room === 'ai-assistant') {
      const time = new Date().toLocaleTimeString();
      const userMessage = {
        room,
        username: socket.username,
        message,
        time
      };
      io.to(room).emit('receive_message', userMessage);

      const aiReply = await askGemini(message);
      const aiMessage = {
        room,
        username: 'AI Bot',
        message: aiReply,
        time: new Date().toLocaleTimeString()
      };
      io.to(room).emit('receive_message', aiMessage);
    } else {
      const time = new Date().toLocaleTimeString();
      const msg = new Message({ room, username: socket.username, message, time });
      await msg.save();
      io.to(room).emit('receive_message', { room, username: socket.username, message, time });
    }
  });

  // ✅ NEW: Typing indicators
  socket.on('typing', ({ room, username }) => {
    console.log(`👤 ${username} is typing in room ${room}`);
    socket.to(room).emit('user_typing', { username });
  });

  socket.on('stop_typing', ({ room, username }) => {
    console.log(`👤 ${username} stopped typing in room ${room}`);
    socket.to(room).emit('user_stopped_typing', { username });
  });

  socket.on('delete_room', async (roomCode) => {
    const room = await Room.findOne({ code: roomCode });
    if (room && room.adminId === socket.id) {
      await Message.deleteMany({ room: roomCode });
      await Room.deleteOne({ code: roomCode });
      delete roomUsers[roomCode];
      io.to(roomCode).emit('room_deleted');
      io.in(roomCode).socketsLeave(roomCode);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const room in roomUsers) {
      roomUsers[room] = roomUsers[room].filter(u => u.id !== socket.id);
      io.to(room).emit('update_users', roomUsers[room].map(u => u.name));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});