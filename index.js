const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '../client')));

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
        io.emit('update-all', { users: Object.values(users), servers });
    });

    // 서버 생성 기능
    socket.on('create-server', (serverName) => {
        const newServer = { id: uuidv4(), name: serverName, owner: socket.id };
        servers.push(newServer);
        io.emit('update-all', { users: Object.values(users), servers });
    });

    socket.on('join-room', (roomId) => {
        if (users[socket.id]?.currentRoom) socket.leave(users[socket.id].currentRoom);
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
            msg: data.msg, // 암호화된 본문
            timestamp: new Date().toLocaleTimeString(),
            senderId: socket.id
        };
        if (!chatHistory[user.currentRoom]) chatHistory[user.currentRoom] = [];
        chatHistory[user.currentRoom].push(msgData);
        io.to(user.currentRoom).emit('message', msgData);
    });

    socket.on('call-request', (data) => socket.broadcast.emit('incoming-call', data));
    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('update-all', { users: Object.values(users), servers });
    });
});

server.listen(3000, () => console.log('🚀 Discord Clone Server on 3000'));