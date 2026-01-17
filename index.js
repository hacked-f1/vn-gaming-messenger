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
// 📁 정적 파일 서비스 (경로 수정됨 ⭐)
// ========================================
// '../client'를 빼고 현재 폴더(__dirname)를 직접 바라보게 수정했습니다.
app.use(express.static(__dirname));

// ========================================
// 🌐 Express 라우팅 (경로 수정됨 ⭐)
// ========================================
app.get('/', (req, res) => {
  // 파일 위치를 현재 폴더의 index.html로 정확히 지정
  res.sendFile(path.join(__dirname, 'index.html'));
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

  socket.emit('chat-history', messageHistory);
  socket.emit('users-list', Array.from(users.values()));

  socket.on('message', (data) => {
    try {
      if (!data || typeof data !== 'object') return;
      const { name, msg } = data;
      if (!name || !name.trim() || !msg || !msg.trim()) return;

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

  socket.on('disconnect', () => {
    const userName = users.get(socket.id) || '익명';
    users.delete(socket.id);
    io.emit('users-list', Array.from(users.values()));
  });
});

// ========================================
// 🚀 서버 시작
// ========================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ 서버 가동 중! 포트: ${PORT}`);
  console.log(`🔗 접속 주소: http://0.0.0.0:${PORT}`);
});
