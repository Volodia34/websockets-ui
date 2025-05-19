import { WebSocketServer } from 'ws';
import { handleRegistration } from './handlers/registrationHandler.js';
import { generateConnectionId } from './utils.js';
const wss = new WebSocketServer({ port: 3000 });
wss.on('connection', (ws) => {
    const connectionId = generateConnectionId();
    console.log(`[${connectionId}] New connection established.`);
    ws.on('message', (message) => {
        let clientMsg;
        try {
            clientMsg = JSON.parse(message.toString());
        }
        catch (err) {
            console.error(`[${connectionId}] Invalid JSON received.`);
            return;
        }
        switch (clientMsg.type) {
            case 'reg':
                let regData;
                try {
                    regData = JSON.parse(clientMsg.data);
                }
                catch {
                    console.error(`[${connectionId}] Invalid registration data.`);
                    return;
                }
                handleRegistration(ws, wss, regData, clientMsg.id, connectionId);
                break;
            default:
                console.warn(`[${connectionId}] Unknown message type: ${clientMsg.type}`);
        }
    });
    ws.on('close', () => {
        console.log(`[${connectionId}] Connection closed.`);
    });
});
console.log('WebSocket server started on ws://localhost:3000');
