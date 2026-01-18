const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// [수정 없음] 정적 파일(이미지 포함)을 현재 루트 디렉토리에서 제공
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 기본 서버 목록
let users = {}; 
let servers = [{ id: 'global-1', name: 'VOID OFFICIAL', owner: 'system' }]; 
let chatHistory = {};

io.on('connection', (socket) => {
    socket.on('auth-success', (userData) => {
        users[socket.id] = {
            ...userData,
            socketId: socket.id,
            // 아바타 시드도 이름 기반으로 유지
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${userData.displayName}`, 
            currentRoom: null
        };
        socket.emit('login-complete', users[socket.id]);
        updateGlobalState();
    });

    socket.on('update-profile-req', (newName) => {
        if (users[socket.id]) {
            users[socket.id].displayName = newName;
            users[socket.id].avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${newName}`;
            socket.emit('login-complete', users[socket.id]);
            updateGlobalState();
        }
    });

    socket.on('create-server', (serverName) => {
        const newServer = { id: uuidv4(), name: serverName, owner: socket.id };
        servers.push(newServer);
        updateGlobalState();
    });

    socket.on('join-room', (roomId) => {
        if (!users[socket.id]) return;
        if (users[socket.id].currentRoom) socket.leave(users[socket.id].currentRoom);
        users[socket.id].currentRoom = roomId;
        socket.join(roomId);
        socket.emit('load-history', chatHistory[roomId] || []);
    });

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

    socket.on('call-request', (data) => socket.broadcast.emit('incoming-call', data));
    socket.on('disconnect', () => { delete users[socket.id]; updateGlobalState(); });

    function updateGlobalState() {
        io.emit('update-all', { 
            users: Object.values(users).map(u => ({ socketId: u.socketId, displayName: u.displayName, avatar: u.avatar, uid: u.uid })), 
            servers 
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 VOID Server Initiated on Port ${PORT}`));