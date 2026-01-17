const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static(path.join(__dirname, '../client')));

// 메모리 DB
let servers = ['GLOBAL_LOBBY', 'FREE_TALK', 'SECRET_ROOM'];
let users = {}; 
let messageHistory = {}; 

io.on('connection', (socket) => {
    socket.emit('server-list', servers);

    socket.on('join-server', (data) => {
        const { server: serverName, name, pic } = data;
        socket.leaveAll();
        socket.join(serverName);
        users[socket.id] = { name, server: serverName, pic };

        if (!messageHistory[serverName]) messageHistory[serverName] = [];
        socket.emit('chat-history', messageHistory[serverName]);
        io.emit('online-users', Object.values(users));
    });

    socket.on('message', (data) => {
        const user = users[socket.id];
        if (!user) return;
        const messageData = {
            id: Date.now() + Math.random(), // 고유 ID
            name: user.name,
            msg: data.msg,
            pic: user.pic,
            file: data.file || null, 
            server: user.server,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        messageHistory[user.server].push(messageData);
        io.to(user.server).emit('message', messageData);
    });

    // 메시지 삭제 요청 처리
    socket.on('delete-msg', (msgId) => {
        const user = users[socket.id];
        if (user && messageHistory[user.server]) {
            messageHistory[user.server] = messageHistory[user.server].filter(m => m.id !== msgId);
            io.to(user.server).emit('msg-deleted', msgId);
        }
    });

    socket.on('create-server', (sName) => {
        if (!servers.includes(sName)) {
            servers.push(sName);
            io.emit('server-list', servers);
        }
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('online-users', Object.values(users));
    });
});

server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Messenger running on ${PORT}`));