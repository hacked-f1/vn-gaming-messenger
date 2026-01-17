const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 파일이 모두 최상위에 있으므로 경로를 현재 폴더(__dirname)로 고정
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.use(express.static(__dirname));

let users = {}; 
let servers = [{ id: 'global-1', name: 'VOID 공식', owner: 'system' }]; 
let chatHistory = {};

io.on('connection', (socket) => {
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

    socket.on('update-profile-req', (newName) => {
        if (users[socket.id]) {
            users[socket.id].displayName = newName;
            users[socket.id].avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${newName}`;
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
server.listen(PORT, () => console.log(`🚀 VOID Server on ${PORT}`));