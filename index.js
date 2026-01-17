const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const users = new Map();
const messageHistory = [];
const MAX_HISTORY = 50;

io.on('connection', (socket) => {
  console.log('연결:', socket.id);
  
  socket.emit('chat-history', messageHistory);
  socket.emit('users-list', Array.from(users.values()));

  socket.on('message', (data) => {
    if (!data.name || !data.msg) return;

    const userName = data.name.trim();
    users.set(socket.id, userName);

    const messageData = {
      name: userName,
      msg: data.msg.trim(),
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      userId: socket.id,
      type: 'chat'
    };

    messageHistory.push(messageData);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }

    io.emit('message', messageData);
    io.emit('users-list', Array.from(users.values()));
  });

  socket.on('disconnect', () => {
    const userName = users.get(socket.id) || '익명';
    users.delete(socket.id);
    
    const systemMsg = {
      name: '시스템',
      msg: `${userName}님이 퇴장하셨습니다.`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      type: 'system'
    };
    
    messageHistory.push(systemMsg);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }

    io.emit('system-message', systemMsg);
    io.emit('users-list', Array.from(users.values()));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`포트 ${PORT}에서 실행 중`);
});
