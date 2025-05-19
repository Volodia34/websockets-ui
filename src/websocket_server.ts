import { WebSocketServer, WebSocket } from 'ws';
import * as http from "node:http";

const port = 3000;

const wss = new WebSocketServer({ port });

console.log(`WebSocket server started on port ${port}`);
console.log(`WebSocket parameters: ws://localhost:${port}`);

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    console.log('Client connected');

    ws.on('message', (data: Buffer, isBinary: boolean) => {
        const messageString = data.toString('utf-8');
        console.log(messageString);

        try {
            const parsedMessage = JSON.parse(messageString);
            ws.send(JSON.stringify(parsedMessage));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('Failed to parse message or handle it:', errorMessage);
            ws.send(JSON.stringify({ error: errorMessage }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error with client: ${error.message}`);
    })


});


wss.on('close', () => {
    console.log('WebSocketServer has closed.');
});
