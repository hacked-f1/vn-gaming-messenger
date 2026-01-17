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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ========================================
// 📊 데이터 저장소
// ========================================
const users = new Map(); // socket.id -> { userName, currentServer, profilePic }
const messageHistory = {}; // serverName -> [messages]
const MAX_HISTORY = 50;

// ========================================
// 🔗 Socket.io 이벤트 처리
// ========================================
io.on('connection', (socket) => {
  console.log(`✅ 연결됨: ${socket.id}`);

  // 1. 서버(방) 입장 이벤트
  socket.on('join-server', (data) => {
    const { server: serverName, name, pic } = data;
    
    // 이전 방 퇴장 처리
    const prevUser = users.get(socket.id);
    if (prevUser && prevUser.currentServer) {
      socket.leave(prevUser.currentServer);
    }

    // 새로운 방 입장
    socket.join(serverName);
    users.set(socket.id, { userName: name, currentServer: serverName, profilePic: pic });

    // 방 전용 히스토리 초기화 및 전달
    if (!messageHistory[serverName]) messageHistory[serverName] = [];
    socket.emit('chat-history', messageHistory[serverName]);

    console.log(`${name}님이 ${serverName} 입장`);
  });

  // 2. 메시지 이벤트 (특정 방으로만 전송)
  socket.on('message', (data) => {
    if (!data || !data.msg) return;

    const user = users.get(socket.id);
    const serverName = data.server || (user ? user.currentServer : 'GLOBAL_LOBBY');
    const userName = data.name || (user ? user.userName : '익명');

    const messageData = {
      name: userName,
      msg: data.msg.trim(),
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      type: 'chat',
      profilePic: data.pic || (user ? user.profilePic : "") // 직접 가져온 사진 우선 적용
    };

    // 히스토리 저장
    if (!messageHistory[serverName]) messageHistory[serverName] = [];
    messageHistory[serverName].push(messageData);
    if (messageHistory[serverName].length > MAX_HISTORY) messageHistory[serverName].shift();

    // 해당 서버(방)에만 브로드캐스트
    io.to(serverName).emit('message', messageData);
  });

  // 3. 연결 해제
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`❌ 퇴장: ${user.userName}`);
      users.delete(socket.id);
    }
  });
});

// ========================================
// 🚀 서버 시작
// ========================================
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 서버 실행 중: 포트 ${PORT}`);
});