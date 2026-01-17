// ========================================
// 📦 필수 모듈 임포트
// ========================================
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// ========================================
// 🔧 Express 및 Socket.io 초기화
// ========================================
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false
  }
});

// ========================================
// 📁 정적 파일 서비스
// ========================================
// server/index.js 기준으로 ../client 폴더를 정적 경로로 지정
app.use(express.static(path.join(__dirname, '../client')));

// SPA 라우팅: 정적 파일로 처리되지 않은 모든 요청은 index.html 반환
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ========================================
// 📊 데이터 저장소
// ========================================
const users = new Map();
const messageHistory = [];
const MAX_HISTORY = 50;

// ========================================
// 🔗 Socket.io 이벤트 처리
// ========================================
io.on('connection', (socket) => {
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  console.log(`\n✅ [연결] ${socket.id} (${timestamp})`);

  // 기존 데이터 전달
  socket.emit('chat-history', messageHistory);
  socket.emit('users-list', Array.from(users.values()));

  // 메시지 이벤트
  socket.on('message', (data) => {
    try {
      if (!data || typeof data !== 'object') return;
      const { name, msg } = data;
      if (!name || !msg) return;

      const userName = name.trim();
      const isNewUser = !users.has(socket.id);
      users.set(socket.id, userName);

      if (isNewUser) {
        io.emit('users-list', Array.from(users.values()));
      }

      const messageData = {
        name: userName,
        msg: msg.trim(),
        timestamp: new Date().toLocaleTimeString('ko-KR'),
        userId: socket.id,
        type: 'chat'
      };

      messageHistory.push(messageData);
      if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
      io.emit('message', messageData);
    } catch (err) {
      console.error('❌ 메시지 처리 오류:', err.message);
    }
  });

  // 연결 해제 이벤트
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
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
    io.emit('system-message', systemMsg);
    io.emit('users-list', Array.from(users.values()));
  });

  // 입장 메시지
  const systemMsg = {
    name: '시스템',
    msg: `사용자가 입장하셨습니다.`,
    timestamp: new Date().toLocaleTimeString('ko-KR'),
    type: 'system'
  };
  messageHistory.push(systemMsg);
  if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
  io.emit('system-message', systemMsg);
});

// ========================================
// 🚀 서버 시작
// ========================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ 서버 실행 중: 포트 ${PORT}`);
});
