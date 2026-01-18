const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 정적 파일 서빙 (이미지 등)
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 데이터 저장소
let users = {}; 
let servers = [{ id: 'global-1', name: 'VOID LOBBY', owner: 'system' }]; 
let chatHistory = {};

io.on('connection', (socket) => {
    
    // 1. 로그인 성공 시 사용자 정보 저장
    socket.on('auth-success', (userData) => {
        users[socket.id] = {
            ...userData,
            socketId: socket.id,
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${userData.displayName}`, 
            currentRoom: null,
            bio: "I only fly away...", // 기본 상태 메시지
            statusMsg: "Playing HELLDIVERS 2" // 예시 상태
        };
        socket.emit('login-complete', users[socket.id]);
        updateGlobalState();
    });

    // 2. 프로필 정보 요청 처리
    socket.on('get-user-info', (targetSocketId) => {
        if(users[targetSocketId]) {
            socket.emit('user-info-res', users[targetSocketId]);
        }
    });

    // 3. 자기소개(Bio) 수정
    socket.on('update-bio', (newBio) => {
        if(users[socket.id]) {
            users[socket.id].bio = newBio;
            updateGlobalState(); // 변경사항 전파
        }
    });

    // 서버 생성
    socket.on('create-server', (serverName) => {
        const newServer = { id: uuidv4(), name: serverName, owner: socket.id };
        servers.push(newServer);
        updateGlobalState();
    });

    // 방 입장 (채널 또는 1:1 DM)
    socket.on('join-room', (roomId) => {
        if (!users[socket.id]) return;
        if (users[socket.id].currentRoom) socket.leave(users[socket.id].currentRoom);
        
        users[socket.id].currentRoom = roomId;
        socket.join(roomId);
        socket.emit('load-history', chatHistory[roomId] || []);
    });

    // 메시지 전송
    socket.on('message', (data) => {
        const user = users[socket.id];
        if (!user || !user.currentRoom) return;
        
        const msgData = {
            id: uuidv4(),
            sender: user.displayName,
            avatar: user.avatar,
            msg: data.msg, 
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            senderId: socket.id
        };

        if (!chatHistory[user.currentRoom]) chatHistory[user.currentRoom] = [];
        chatHistory[user.currentRoom].push(msgData);
        
        io.to(user.currentRoom).emit('message', msgData);
    });

    socket.on('call-request', (data) => socket.broadcast.emit('incoming-call', data));
    
    socket.on('disconnect', () => { 
        delete users[socket.id]; 
        updateGlobalState(); 
    });

    function updateGlobalState() {
        io.emit('update-all', { 
            users: Object.values(users).map(u => ({ 
                socketId: u.socketId, 
                displayName: u.displayName, 
                avatar: u.avatar, 
                uid: u.uid,
                statusMsg: u.statusMsg
            })), 
            servers 
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 VOID Server Running on ${PORT}`));