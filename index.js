const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ========================================
// 🔧 환경 설정 (로컬 & Render 배포 대응)
// ========================================
const PORT = process.env.PORT || 3000;

// CORS 설정: 로컬/배포 환경 모두 지원
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'https://vn-gaming-messenger.onrender.com'
];

// 환경 변수에서 추가 CORS 도메인 가능
if (process.env.CORS_ORIGIN) {
  corsOrigins.push(process.env.CORS_ORIGIN);
}

const io = new Server(server, {
  cors: { 
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(express.static(path.join(__dirname, '../client')));

// ========================================
// 📊 데이터 저장소
// ========================================
const users = new Map(); // socketId -> userName
const messageHistory = [];
const MAX_HISTORY = 50;

// ========================================
// 🔗 Socket.io 연결 처리
// ========================================
io.on('connection', (socket) => {
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  console.log(`\n[접속 ${timestamp}] 사용자 ID: ${socket.id}`);
  console.log(`[히스토리] 전송할 메시지: ${messageHistory.length}개`);
  
  // 1️⃣ 먼저 히스토리를 보낸다 (입장 알림보다 먼저)
  socket.emit('chat-history', messageHistory);
  
  // 현재 사용자 목록을 먼저 보낸다 (접속 직후)
  const currentUsersList = Array.from(users.values());
  socket.emit('users-list', currentUsersList);
  
  socket.on('message', (data) => {
    // 데이터 검증
    if (!data || typeof data !== 'object') {
      console.warn(`[경고] 잘못된 메시지 형식:`, data);
      return;
    }

    const { name, msg } = data;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      console.warn(`[경고] 사용자명 없음 (${socket.id})`);
      return;
    }

    if (!msg || typeof msg !== 'string' || msg.trim() === '') {
      console.warn(`[경고] 메시지 내용 없음 (${socket.id})`);
      return;
    }

    // 사용자 정보 저장
    const userName = name.trim();
    const isNewUser = !users.has(socket.id);
    users.set(socket.id, userName);
    
    // 새로운 사용자면 모든 클라이언트에게 사용자 목록 업데이트
    if (isNewUser) {
      console.log(`[사용자 등록] ${userName}`);
      const usersList = Array.from(users.values());
      io.emit('users-list', usersList);
    }

    // 메시지 데이터 생성
    const messageData = {
      name: userName,
      msg: msg.trim(),
      timestamp: new Date().toLocaleTimeString('ko-KR'),
      userId: socket.id,
      type: 'chat'
    };

    // 히스토리에 저장
    messageHistory.push(messageData);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }

    console.log(`[메시지] ${userName}: ${msg.substring(0, 30)}${msg.length > 30 ? '...' : ''}`);
    
    // 모든 클라이언트에게 전달
    io.emit('message', messageData);
  });
  
  socket.on('disconnect', () => {
    const userName = users.get(socket.id) || '익명';
    users.delete(socket.id);
    
    console.log(`[퇴장] ${userName} (${socket.id}) - 남은 사용자: ${io.engine.clientsCount}명`);
    
    // 퇴장 알림을 히스토리에 저장 후 전송
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
    
    // 모든 클라이언트에게 업데이트된 사용자 목록 전송
    const usersList = Array.from(users.values());
    io.emit('users-list', usersList);
  });

  // 2️⃣ 입장 알림을 마지막에 보낸다
  const systemMsg = {
    name: '시스템',
    msg: `새로운 사용자가 입장하셨습니다. (총 ${io.engine.clientsCount}명)`,
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
// 🚀 서버 실행
// ========================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  ✅ 서버가 포트 ${PORT}에서 작동 중!`);
  console.log(`║  🌍 CORS 허용 도메인:`);
  corsOrigins.forEach(origin => {
    console.log(`║     - ${origin}`);
  });
  console.log(`║  📌 로컬 접속: http://localhost:${PORT}`);
  console.log(`║  🎮 베트남 게이머 메신저`);
  console.log(`╚════════════════════════════════════════════╝\n`);
});