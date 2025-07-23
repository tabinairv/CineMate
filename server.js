const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const rooms = {};

wss.on('connection', ws => {
    let userRoom, userName;
    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'join') {
            userRoom = data.room;
            userName = data.username;
            if (!rooms[data.room]) rooms[data.room] = [];
            rooms[data.room].push({ ws, username: data.username });
            ws.send(JSON.stringify({ type: 'roomCreated', room: data.room }));
            rooms[data.room].forEach(client => {
                if (client.ws !== ws) {
                    client.ws.send(JSON.stringify({ type: 'userJoined', room: data.room, username: data.username }));
                }
            });
        } else if (data.type === 'endRoom') {
            rooms[data.room]?.forEach(client => client.ws.send(JSON.stringify({ type: 'endRoom' })));
            delete rooms[data.room];
        } else if (['sync', 'webrtc-offer', 'webrtc-answer', 'webrtc-ice'].includes(data.type)) {
            rooms[data.room]?.forEach(client => {
                if (client.ws !== ws && (!data.to || client.username === data.to)) {
                    client.ws.send(JSON.stringify(data));
                }
            });
        }
    });
    ws.on('close', () => {
        if (userRoom) {
            rooms[userRoom] = rooms[userRoom].filter(client => client.ws !== ws);
            if (rooms[userRoom].length === 0) delete rooms[userRoom];
        }
    });
});