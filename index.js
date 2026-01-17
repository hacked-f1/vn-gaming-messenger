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
app.use(express.static(path.join(__dirname)));

// ========================================
// 🌐 Express 라우팅
// ========================================
app.get('/', (req, res) => {
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
  console.log(`📬 히스토리 메시지: ${messageHistory.length}개`);

  // 기존 메시지 히스토리 전송
  socket.emit('chat-history', messageHistory);

  // 현재 온라인 사용자 목록 전송
  const usersList = Array.from(users.values());
  socket.emit('users-list', usersList);

  // 메시지 수신
  socket.on('message', (data) => {
    try {
      if (!data || typeof data !== 'object') {
        console.warn('⚠️  잘못된 데이터 형식');
        return;
      }

      const { name, msg } = data;

      if (!name || typeof name !== 'string' || !name.trim()) {
        console.warn('⚠️  사용자명 없음');
        return;
      }

      if (!msg || typeof msg !== 'string' || !msg.trim()) {
        console.warn('⚠️  메시지 내용 없음');
        return;
      }

      const userName = name.trim();
      const isNewUser = !users.has(socket.id);
      users.set(socket.id, userName);

      if (isNewUser) {
        console.log(`👤 [신규 사용자] ${userName}`);
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
      if (messageHistory.length > MAX_HISTORY) {
        messageHistory.shift();
      }

      console.log(`💬 ${userName}: ${msg.substring(0, 30)}`);
      io.emit('message', messageData);
    } catch (err) {
      console.error('❌ 메시지 처리 오류:', err.message);
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const userName = users.get(socket.id) || '익명';
    users.delete(socket.id);
    console.log(`🚪 [퇴장] ${userName} - 남은 사용자: ${io.engine.clientsCount}명`);

    if (io.engine.clientsCount > 0) {
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
    }

    io.emit('users-list', Array.from(users.values()));
  });

  // 입장 알림
  const systemMsg = {
    name: '시스템',
    msg: `사용자가 입장하셨습니다. (총 ${io.engine.clientsCount}명)`,
    timestamp: new Date().toLocaleTimeString('ko-KR'),
    type: 'system'
  };
  messageHistory.push(systemMsg);
  if (messageHistory.length > MAX_HISTORY) {
    messageHistory.shift();
  }
  io.emit('system-message', systemMsg);
});

// ========================================
// 🚀 서버 시작
// ========================================
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log(`║  ✅ 서버 실행 중: 포트 ${PORT}`);
  console.log('║  🌍 CORS: 모든 도메인 허용');
  console.log('║  🔗 호스트: 0.0.0.0');
  console.log(`║  📌 Local: http://localhost:${PORT}`);
  console.log('║  🎮 베트남 게이머 메신저');
  console.log('╚════════════════════════════════════════════╝\n');
});

// 에러 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
