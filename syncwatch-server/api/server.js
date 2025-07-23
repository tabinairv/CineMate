 const { WebSocketServer } = require('ws');
  const http = require('http');

  module.exports = async (req, res) => {
      console.log('Received request:', req.url);
      if (req.url === '/ws' && req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
          const wss = new WebSocketServer({ noServer: true });
          const rooms = {};

          wss.on('connection', ws => {
              console.log('New WebSocket client connected');
              let userRoom, userName;
              ws.on('message', message => {
                  console.log('Received:', message.toString());
                  try {
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
                  } catch (error) {
                      console.error('Message processing error:', error);
                  }
              });
              ws.on('close', () => {
                  console.log('Client disconnected');
                  if (userRoom) {
                      rooms[userRoom] = rooms[userRoom].filter(client => client.ws !== ws);
                      if (rooms[userRoom].length === 0) delete rooms[userRoom];
                  }
              });
          });

          const server = http.createServer();
          server.on('upgrade', (request, socket, head) => {
              if (request.url === '/ws') {
                  wss.handleUpgrade(request, socket, head, ws => {
                      wss.emit('connection', ws, request);
                  });
              } else {
                  socket.destroy();
              }
          });

          // Signal Vercel to keep the connection open
          res.setHeader('Connection', 'Upgrade');
          res.setHeader('Upgrade', 'websocket');
          return wss;
      } else {
          res.statusCode = 400;
          res.end('Not a WebSocket request');
      }
  };