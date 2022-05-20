const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const moment = require('moment')
const formatMessage = require('./utils/messages');
const randomid = require('randomid');
const { InMemorySessionStore } = require("./sessionStore");
const sessionStore = new InMemorySessionStore();

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-headers"],
        credentials: true,
        transports: ['websocket', 'polling'],
    },
    allowEIO3: true
});

io.use(async (socket, next) => {
    const sessionID = socket.handshake.auth.sessionID;
    if (sessionID) {
      const session = await sessionStore.findSession(sessionID);
      if (session) {
        socket.sessionID = sessionID; 
        socket.id = session.id;
        socket.username = session.username;
        return next();
        }
    }else{
        const username = socket.handshake.auth.username;
        if (!username) {
            return next(new Error("invalid username"));
        }

        socket.sessionID = randomid(14);
        socket.username = username;
        next();
    }

    
});

io.on("connection", async (socket) => {
    console.log("Socket connected...");

    // persist session
    sessionStore.saveSession(socket.sessionID, {
        id: socket.id,
        username: socket.username,
        connected: true,
    });

    socket.emit("session", {
        sessionID: socket.sessionID,
        id: socket.id,
    });

    // const users = [];
    // for (let [id, socket] of io.of("/").sockets) {
    //   users.push({
    //     id: id,
    //     username: socket.username,
    //   });
    // }

    const users = [];
    const sessions = sessionStore.findAllSessions()

    sessions.forEach((session) => {
        if(session.connected === true){
            users.push({
                id: session.id,
                username: session.username,
                connected: session.connected,
            });
        }
        
    });

    socket.emit("users", users);
    
    socket.broadcast.emit("user connected", {
        id: socket.id,
        username: socket.username,
        connected: true,
    });

    socket.on('disconnect', () => {
        id = socket.id,
        io.emit('userleaves', id)
        console.log("Socket disconnect...");

        sessionStore.saveSession(socket.sessionID, {
            id: socket.id,
            username: socket.username,
            connected: false,
        });
    })

    socket.on('logout', async (sessionID) => {
        console.log(sessionID)
        const user = sessionStore.findSession(sessionID)
        sessionStore.removeSession(sessionID, user)
    })


    socket.on("privateMessage", ({message, to }) => {
        console.log(message, to, socket.id)
        socket.to(to).to(socket.id).emit("privateMessage", {
            message,
            time: moment().format('h:mm a'),
            from: socket.id,
            to,
        });
    });
})


server.listen(5000, () => {
console.log("Server is listening on port 5000")})

