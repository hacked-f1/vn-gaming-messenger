const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    maxHttpBufferSize: 1e8,
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, '../client')));

// --- 서버 데이터베이스 (메모리 저장소) ---
let users = {};          // { socketId: { name, pic, room, peerId, status } }
let messageHistory = {}; // { roomName: [ {id, senderId, name, msg, timestamp, isExpiring} ] }
let activeRooms = ['GLOBAL_LOBBY', 'DEVELOPER_TALK', 'SECRET_ZONE', 'TRADING'];

io.on('connection', (socket) => {
    console.log(`📡 New Connection: ${socket.id}`);

    // [기능 1] 인증 및 초기화
    socket.on('auth', (data) => {
        users[socket.id] = {
            id: socket.id,
            name: data.name || 'Anonymous',
            pic: data.pic || 'https://api.dicebear.com/7.x/bottts/svg?seed=1',
            peerId: data.peerId || '',
            room: 'GLOBAL_LOBBY',
            status: 'online'
        };
        socket.join('GLOBAL_LOBBY');
        
        // 유저에게 현재 서버 상태 전송
        socket.emit('init-info', { rooms: activeRooms, history: messageHistory['GLOBAL_LOBBY'] || [] });
        io.emit('user-update', Object.values(users));
    });

    // [기능 2] 방 변경 (채널 입장)
    socket.on('join-room', (roomName) => {
        const user = users[socket.id];
        if (!user) return;

        socket.leave(user.room);
        user.room = roomName;
        socket.join(roomName);

        console.log(`🚪 ${user.name} moved to ${roomName}`);
        
        // 해당 방의 대화 내역만 추출해서 보냄
        socket.emit('chat-history', messageHistory[roomName] || []);
        io.emit('user-update', Object.values(users));
    });

    // [기능 3] 실시간 메시지 처리 (E2EE 암호화 전제)
    socket.on('message', (data) => {
        const user = users[socket.id];
        if (!user) return;

        const msgObj = {
            id: 'msg_' + Date.now() + Math.random().toString(36).substr(2, 5),
            senderId: socket.id,
            name: user.name,
            pic: user.pic,
            msg: data.msg,
            type: data.type || 'text',
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            readCount: 1, // 기본적으로 나 자신은 읽음
            isExpiring: data.isExpiring || false // 사라지는 메시지 여부
        };

        if (!messageHistory[user.room]) messageHistory[user.room] = [];
        messageHistory[user.room].push(msgObj);

        // 메시지 갯수 제한 (메모리 최적화: 방당 200개)
        if (messageHistory[user.room].length > 200) messageHistory[user.room].shift();

        io.to(user.room).emit('message', msgObj);

        // [기능 4] 사라지는 메시지 (타이머)
        if (msgObj.isExpiring) {
            setTimeout(() => {
                messageHistory[user.room] = messageHistory[user.room].filter(m => m.id !== msgObj.id);
                io.to(user.room).emit('msg-deleted', msgObj.id);
            }, 10000); // 10초 후 자동 삭제
        }
    });

    // [기능 5] 입력 중 상태 표시 (Typing...)
    socket.on('typing', (isTyping) => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('display-typing', { 
                id: socket.id, 
                name: user.name, 
                isTyping: isTyping 
            });
        }
    });

    // [기능 6] 메시지 삭제 (본인인 경우에만 허용)
    socket.on('delete-msg', (msgId) => {
        const user = users[socket.id];
        if (!user) return;

        const room = user.room;
        if (messageHistory[room]) {
            const msgIndex = messageHistory[room].findIndex(m => m.id === msgId);
            if (msgIndex !== -1) {
                // 권한 체크
                if (messageHistory[room][msgIndex].senderId === socket.id) {
                    messageHistory[room].splice(msgIndex, 1);
                    io.to(room).emit('msg-deleted', msgId);
                }
            }
        }
    });

    // [기능 7] 메시지 검색 요청
    socket.on('search-msg', (keyword) => {
        const user = users[socket.id];
        if (!user || !messageHistory[user.room]) return;
        
        const results = messageHistory[user.room].filter(m => m.msg.includes(keyword));
        socket.emit('search-results', results);
    });

    // [기능 8] 통화 요청 중계 (WebRTC Signal)
    socket.on('call-request', (data) => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('incoming-call', { 
                fromName: user.name, 
                peerId: data.peerId 
            });
        }
    });

    // [기능 9] 연결 종료
    socket.on('disconnect', () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        delete users[socket.id];
        io.emit('user-update', Object.values(users));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ===========================================
    🚀 VOID PRO SERVER IS RUNNING!
    PORT: ${PORT}
    MODE: FULL-STACK MESSENGER
    ===========================================
    `);
});