const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// [중요] Render 경로 에러 방지: 최상위 폴더 기준 client 폴더 연결
const clientPath = path.resolve(__dirname, '../client');
app.use(express.static(clientPath));

let users = {}; 
let servers = [{ id: 'global-1', name: 'VOID 공식', owner: 'system' }]; 
let chatHistory = {};

io.on('connection', (socket) => {
    // 1. 로그인/가입 성공 후 유저 등록
    socket.on('auth-success', (userData) => {
        users[socket.id] = {
            ...userData,
            socketId: socket.id,
            avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.displayName}`,
            currentRoom: null
        };
        socket.emit('login-complete', users[socket.id]);
        updateGlobalState();
    });

    // 2. 프로필 업데이트
    socket.on('update-profile-req', (newName) => {
        if (users[socket.id]) {
            users[socket.id].displayName = newName;
            users[socket.id].avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${newName}`;
            socket.emit('login-complete', users[socket.id]);
            updateGlobalState();
        }
    });

    // 3. 서버(방) 생성
    socket.on('create-server', (serverName) => {
        const newServer = { id: uuidv4(), name: serverName, owner: socket.id };
        servers.push(newServer);
        updateGlobalState();
    });

    // 4. 방 입장 및 기록 로드
    socket.on('join-room', (roomId) => {
        const user = users[socket.id];
        if (!user) return;
        if (user.currentRoom) socket.leave(user.currentRoom);
        user.currentRoom = roomId;
        socket.join(roomId);
        socket.emit('load-history', chatHistory[roomId] || []);
    });

    // 5. 메시지 전송 (암호화된 채로 유통)
    socket.on('message', (data) => {
        const user = users[socket.id];
        if (!user || !user.currentRoom) return;

        const msgData = {
            id: uuidv4(),
            sender: user.displayName,
            avatar: user.avatar,
            msg: data.msg, 
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            senderId: socket.id
        };

        if (!chatHistory[user.currentRoom]) chatHistory[user.currentRoom] = [];
        chatHistory[user.currentRoom].push(msgData);
        io.to(user.currentRoom).emit('message', msgData);
    });

    // 6. 통화 요청
    socket.on('call-request', (data) => socket.broadcast.emit('incoming-call', data));

    socket.on('disconnect', () => {
        delete users[socket.id];
        updateGlobalState();
    });

    function updateGlobalState() {
        io.emit('update-all', { 
            users: Object.values(users).map(u => ({ socketId: u.socketId, displayName: u.displayName, avatar: u.avatar, uid: u.uid })), 
            servers 
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));