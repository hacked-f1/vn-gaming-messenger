const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    maxHttpBufferSize: 1e8, // 100MB 파일 전송 허용
    cors: { origin: "*" } 
});

app.use(express.static(path.join(__dirname, '../client')));

// DB 대용 메모리 저장소
let users = {}; // socket.id -> {name, pic, peerId, room}
let messageStore = {}; // roomName -> [messages]
let activeServers = ['GLOBAL_LOBBY', 'DEVELOPER', 'GAMING'];

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // 초기 데이터 전달
    socket.emit('init-data', { servers: activeServers });

    // 유저 인증 및 프로필 등록
    socket.on('auth', (data) => {
        users[socket.id] = { 
            id: socket.id, 
            name: data.name, 
            pic: data.pic, 
            peerId: data.peerId,
            room: 'GLOBAL_LOBBY' 
        };
        socket.join('GLOBAL_LOBBY');
        io.emit('user-update', Object.values(users));
    });

    // 서버(채널) 입장
    socket.on('join-room', (roomName) => {
        const user = users[socket.id];
        if(!user) return;
        
        socket.leave(user.room);
        user.room = roomName;
        socket.join(roomName);
        
        // 이전 대화 기록 전송
        socket.emit('chat-history', messageStore[roomName] || []);
        io.emit('user-update', Object.values(users));
    });

    // 메시지 처리 (E2EE 암호화된 상태로 중계)
    socket.on('message', (data) => {
        const user = users[socket.id];
        if(!user) return;

        const msgObj = {
            id: Date.now() + Math.random(),
            senderId: socket.id,
            name: user.name,
            pic: user.pic,
            msg: data.msg, // 암호화된 텍스트
            file: data.file || null,
            fileName: data.fileName || null,
            timestamp: new Date().toLocaleTimeString(),
            readBy: [socket.id] // 보낸 사람은 읽음 처리
        };

        if(!messageStore[user.room]) messageStore[user.room] = [];
        messageStore[user.room].push(msgObj);
        
        io.to(user.room).emit('message', msgObj);
    });

    // 입력 중 상태 (Typing Indicator)
    socket.on('typing', (isTyping) => {
        const user = users[socket.id];
        if(user) {
            socket.to(user.room).emit('user-typing', { name: user.name, isTyping });
        }
    });

    // 메시지 삭제
    socket.on('delete-msg', (msgId) => {
        const user = users[socket.id];
        if(user && messageStore[user.room]) {
            messageStore[user.room] = messageStore[user.room].filter(m => m.id !== msgId);
            io.to(user.room).emit('msg-deleted', msgId);
        }
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('user-update', Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));