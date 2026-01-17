const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // 이미지 전송을 위해 10MB까지 허용
});

app.use(express.static(path.join(__dirname, '../client')));

// 메모리 DB (서버 종료 전까지 유지)
let servers = ['GLOBAL_LOBBY', 'FREE_TALK', 'SECRET_ROOM'];
let users = {}; 
let messageHistory = {}; 

io.on('connection', (socket) => {
    // 서버 목록 전달
    socket.emit('server-list', servers);

    // 방 입장
    socket.on('join-server', (data) => {
        const { server: serverName, name, pic } = data;
        socket.leaveAll();
        socket.join(serverName);
        
        users[socket.id] = { name, server: serverName, pic };

        // 해당 방 히스토리 전송
        if (!messageHistory[serverName]) messageHistory[serverName] = [];
        socket.emit('chat-history', messageHistory[serverName]);

        // 온라인 유저 갱신
        io.emit('online-users', Object.values(users));
    });

    // 메시지 처리 (텍스트/이미지 통합)
    socket.on('message', (data) => {
        const user = users[socket.id];
        if (!user) return;

        const messageData = {
            name: user.name,
            msg: data.msg,
            pic: user.pic,
            file: data.file || null, 
            server: user.server,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };

        if (!messageHistory[user.server]) messageHistory[user.server] = [];
        messageHistory[user.server].push(messageData);
        if (messageHistory[user.server].length > 100) messageHistory[user.server].shift();

        io.to(user.server).emit('message', messageData);
    });

    // 서버 생성
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server on ${PORT}`));