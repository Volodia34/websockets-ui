import {WebSocketServer, WebSocket} from 'ws';
import type {ClientMessage, RegClientData} from './types.d.ts';
import {handleRegistration} from './handlers/registrationHandler.js';
import {generateConnectionId} from './utils.js';
import {handleCreateRoom} from "./handlers/roomHandler.js";

const wss = new WebSocketServer({port: 3000});

const getPlayerIdFromWs = (socket: WebSocket): string | undefined => {
    return (socket as any).playerId;
};

wss.on('connection', (ws: WebSocket) => {
    const connectionId = generateConnectionId();
    console.log(`[${connectionId}] New connection established.`);

    ws.on('message', (message) => {
        const currentPlayerId = getPlayerIdFromWs(ws);
        let clientMsg: ClientMessage;

        console.log(message.toString())

        try {
            clientMsg = JSON.parse(message.toString());
        } catch (err) {
            console.error(`[${connectionId}] Invalid JSON received.`);
            return;
        }

        switch (clientMsg.type) {
            case 'reg':
                let regData: RegClientData;
                try {
                    regData = JSON.parse(clientMsg.data);
                } catch {
                    console.error(`[${connectionId}] Invalid registration data.`);
                    return;
                }
                handleRegistration(ws, wss, regData, clientMsg.id, connectionId);
                break;
            case 'create_room':
                if (!currentPlayerId) {
                    console.warn(`[${connectionId}] Unauthorized 'create_room' attempt.`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: JSON.stringify({message: 'User not authenticated to create room.'}),
                        id: clientMsg.id
                    }));
                    return;
                }
                handleCreateRoom(ws, wss, currentPlayerId, clientMsg.id, connectionId)
                break

            default:
                console.warn(`[${connectionId}] Unknown message type: ${clientMsg.type}`);
        }
    });

    ws.on('close', () => {
        console.log(`[${connectionId}] Connection closed.`);
    });
});

console.log('WebSocket server started on ws://localhost:3000');
