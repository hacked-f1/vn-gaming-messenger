const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

let users = {}; 
let servers = [{ id: 'global-1', name: 'LOBBY', owner: 'system' }]; 
let chatHistory = {};

io.on('connection', (socket) => {
    
    // 로그인
    socket.on('auth-success', (userData) => {
        users[socket.id] = {
            ...userData,
            socketId: socket.id,
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${userData.uid}`,
            bio: "소개가 없습니다.",
            currentRoom: null
        };
        socket.emit('login-complete', users[socket.id]);
        updateGlobalState();
    });

    // 프로필 조회 (Socket ID 대신 UID로 조회)
    socket.on('get-user-info', (targetUid) => {
        // users 객체값 중 uid가 일치하는 사람 찾기
        const targetUser = Object.values(users).find(u => u.uid === targetUid);
        if(targetUser) {
            socket.emit('user-info-res', targetUser);
        } else {
            // 접속 중이지 않더라도, 내 정보 조회일 수 있음. 
            // DB가 없으므로 현재는 접속자만 조회 가능 (추후 개선 가능)
            socket.emit('error', '사용자를 찾을 수 없습니다.'); 
        }
    });

    // 상태 메시지 수정
    socket.on('update-bio', (bio) => {
        if(users[socket.id]) {
            users[socket.id].bio = bio;
        }
    });

    socket.on('create-server', (name) => {
        servers.push({ id: uuidv4(), name: name, owner: socket.id });
        updateGlobalState();
    });

    socket.on('join-room', (roomId) => {
        if(!users[socket.id]) return;
        if(users[socket.id].currentRoom) socket.leave(users[socket.id].currentRoom);
        users[socket.id].currentRoom = roomId;
        socket.join(roomId);
        socket.emit('load-history', chatHistory[roomId] || []);
    });

    socket.on('message', (data) => {
        const user = users[socket.id];
        if(!user || !user.currentRoom) return;

        const msgData = {
            id: uuidv4(),
            sender: user.displayName,
            avatar: user.avatar,
            uid: user.uid, // [핵심] 프로필 조회용 UID 포함
            msg: data.msg,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };

        if(!chatHistory[user.currentRoom]) chatHistory[user.currentRoom] = [];
        chatHistory[user.currentRoom].push(msgData);
        io.to(user.currentRoom).emit('message', msgData);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        updateGlobalState();
    });

    function updateGlobalState() {
        io.emit('update-all', {
            users: Object.values(users).map(u => ({
                uid: u.uid,
                displayName: u.displayName,
                avatar: u.avatar
            })),
            servers
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SERVER RUNNING ON ${PORT}`));