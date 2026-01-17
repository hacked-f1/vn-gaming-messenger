// ========================================
// 📦 필수 모듈
// ========================================
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// ========================================
// 🔧 서버 초기화
// ========================================
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ========================================
// 📁 정적 파일 서비스
// ========================================
app.use(express.static(path.join(__dirname, '../client')));

// 모든 라우트는 index.html 반환
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ========================================
// 📊 데이터 저장소
// ========================================
const users = new Map(); // socket.id -> userName
const messageHistory = [];
const MAX_HISTORY = 100;

// ========================================
// 🔗 Socket.io 이벤트 처리
// ========================================
io.on('connection', (socket) => {
  console.log(`✅ 연결됨: ${socket.id}`);

  // 기존 데이터 전달
  socket.emit('chat-history', messageHistory);
  socket.emit('users-list', Array.from(users.values()));

  // 메시지 이벤트
  socket.on('message', (data) => {
    if (!data || !data.name || !data.msg) return;

    const userName = data.name.trim() || '익명 게이머';
    users.set(socket.id, userName);

    const messageData = {
      name: userName,
      msg: data.msg.trim(),
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      type: 'chat',
      profilePic: data.profilePic || ""
    };

    messageHistory.push(messageData);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();

    io.emit('message', messageData); // 모든 클라이언트에게 전송
    io.emit('users-list', Array.from(users.values()));
  });

  // 연결 해제 이벤트
  socket.on('disconnect', () => {
    const userName = users.get(socket.id) || '익명 게이머';
    users.delete(socket.id);

    const systemMsg = {
      name: '시스템',
      msg: `${userName}님이 퇴장하셨습니다.`,
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      type: 'system'
    };

    messageHistory.push(systemMsg);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();

    io.emit('system-message', systemMsg);
    io.emit('users-list', Array.from(users.values()));
  });
});

// ========================================
// 🚀 서버 시작
// ========================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 서버 실행 중: 포트 ${PORT}`);
});
