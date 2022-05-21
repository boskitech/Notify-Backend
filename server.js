const express = require('express');
const moment = require('moment')
const http = require('http');
const mongoose = require('mongoose')
const { InMemorySessionStore } = require("./sessionStore");
const randomid = require('randomid');
const cors = require('cors')

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const sessionStore = new InMemorySessionStore();


const URL = 'mongodb://127.0.0.1:27017/notifyDb';
const URL2 = 'mongodb+srv://nodetut:boskipass@cluster0.yasfu.mongodb.net/notifyDb?retryWrites=true&w=majority'

mongoose.connect(URL, {useNewUrlParser: true, useUnifiedTopology:true})
    .then(() => console.log('Connected'))
    .catch((err) => console.log(err));

const con = mongoose.connection;

con.on('open', () => {
    console.log('Second database connection passed')
})

con.on('error', () => {
    console.log('Connection failed');
})


app.use(express.json());
app.use(cors({credentials:true, origin: true}));

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
        const userID = socket.handshake.auth.id;
        const username = socket.handshake.auth.username;

        if (!username) {
            return next(new Error("invalid username"));
        }

        socket.sessionID = randomid(14);
        socket.username = username;
        socket.id = userID;
        next();
    }

    
});

io.on("connection", async (socket) => {
    console.log("Socket connected...");

    // persist session
    const userID = socket.handshake.auth.id;
    sessionStore.saveSession(socket.sessionID, {
        id: socket.id,
        username: socket.username,
        connected: true,
    });


    socket.emit("session", {
        sessionID: socket.sessionID,
        id: userID
    });

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

    socket.on("privateMessage", ({message, to }) => {
        console.log(message, to, socket.id)
        socket.to(socket.id).to(to).emit("privateMessage", {
            message,
            time: moment().format('h:mm a'),
            from: socket.id,
            to,
        });
    });
})

app.use('/api/users', require("./routes/users")(express));

server.listen(PORT, () => {
console.log("Server is listening on port 5000")})

