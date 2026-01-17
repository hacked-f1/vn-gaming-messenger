// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '../client')));

// 데이터 저장소 (서버 메모리)
let users = {};       
let rooms = ['LOBBY', 'GAME', 'MUSIC']; 
let chatHistory = {}; 

io.on('connection', (socket) => {
    
    // [1] 로그인 성공 후 유저 정보 등록
    socket.on('auth-success', (userData) => {
        users[socket.id] = {
            socketId: socket.id,
            uid: userData.uid,          // 파이어베이스 고유 ID
            email: userData.email,
            name: userData.displayName, // 닉네임
            avatar: userData.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${userData.uid}`,
            currentRoom: null
        };

        // 로비로 강제 입장
        socket.emit('login-complete', users[socket.id]);
        socket.emit('init-rooms', rooms);
        socket.emit('force-join', 'LOBBY');
    });

    // [2] 방 입장 및 대화 불러오기
    socket.on('join-room', (room) => {
        const user = users[socket.id];
        if (!user) return;

        if (user.currentRoom) socket.leave(user.currentRoom);
        user.currentRoom = room;
        socket.join(room);

        // 이전 대화 기록 전송
        const history = chatHistory[room] || [];
        socket.emit('load-history', history);
        
        // 시스템 메시지
        io.to(room).emit('message', createMsg('SYSTEM', `${user.name}님이 입장했습니다.`));
    });

    // [3] 메시지 전송 (텍스트 & 이미지)
    socket.on('message', (data) => {
        const user = users[socket.id];
        if (!user || !user.currentRoom) return;

        const msgData = createMsg(user.name, data.msg, data.type, user.avatar, socket.id);
        
        if (!chatHistory[user.currentRoom]) chatHistory[user.currentRoom] = [];
        chatHistory[user.currentRoom].push(msgData);

        io.to(user.currentRoom).emit('message', msgData);
    });

    // [4] 기타 기능 (삭제, 입력중, 통화)
    socket.on('delete-msg', (id) => {
        const user = users[socket.id];
        if(user && user.currentRoom) io.to(user.currentRoom).emit('msg-deleted', id);
    });

    socket.on('typing', (isTyping) => {
        const user = users[socket.id];
        if(user && user.currentRoom) socket.to(user.currentRoom).emit('display-typing', { name: user.name, isTyping });
    });

    socket.on('call-request', (data) => socket.broadcast.emit('incoming-call', data));

    socket.on('disconnect', () => delete users[socket.id]);
});

function createMsg(name, msg, type = 'text', avatar = '', senderId = '') {
    return {
        id: uuidv4(), name, msg, type, avatar, senderId,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
}

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 VOID SERVER RUNNING: http://localhost:${PORT}`));