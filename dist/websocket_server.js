import { WebSocketServer } from 'ws';
const port = 3000;
const ws = new WebSocketServer({ port });
console.log(`WebSocket server started on port ${port}`);
console.log(`WebSocket parameters: ws://localhost:${port}`);
ws.on('connection', (socket, req) => {
    console.log('Client connected');
    socket.on('message', (data, isBinary) => {
        const messageString = data.toString('utf-8');
        console.log(messageString);
        try {
            const parsedMessage = JSON.parse(messageString);
            socket.send(JSON.stringify(parsedMessage));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Failed to parse message or handle it:', errorMessage);
            socket.send(JSON.stringify({ error: errorMessage }));
        }
    });
});
