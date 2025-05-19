import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'node:http';
import { ClientMessage, RegClientData, AddUserToRoomClientData } from './types.js';
import { handleRegistration } from './handlers/registrationHandler.js';
import { handleCreateRoom, handleAddUserToRoom } from './handlers/roomHandler.js';
import { generateConnectionId } from './utils.js';
import { gameRoomsDB, removePlayerFromRooms } from './db.js';
import { broadcastToAll } from './utils.js';

const PORT = 3000;
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server started on ws://localhost:${PORT}`);

const getPlayerIdFromWs = (socket: WebSocket): string | undefined => {
    return (socket as any).playerId;
};

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const connectionId = generateConnectionId();
    const clientIp = req.socket.remoteAddress;
    console.log(`[${connectionId}] New connection established from IP: ${clientIp}`);

    ws.on('message', (message: Buffer) => {
        const currentPlayerId = getPlayerIdFromWs(ws);
        let clientMsg: ClientMessage;
        const messageString = message.toString();

        try {
            clientMsg = JSON.parse(messageString);
        } catch (err) {
            console.error(`[${connectionId}] Invalid JSON received: ${messageString}`);
            ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({message: 'Invalid JSON format.'}), id: 0}));
            return;
        }

        console.log(`[${connectionId}] Rcvd cmd: type=${clientMsg.type}, id=${clientMsg.id}, pId=${currentPlayerId || 'N/A'}`);

        switch (clientMsg.type) {
            case 'reg':
                let regData: RegClientData;
                try {
                    if (typeof clientMsg.data !== 'string') throw new Error('Registration data is not a string');
                    regData = JSON.parse(clientMsg.data);
                    if (!regData.name || !regData.password) throw new Error('Name or password missing in registration data');
                } catch(e) {
                    const errorMsg = e instanceof Error ? e.message : 'Unknown error parsing reg data';
                    console.error(`[${connectionId}] Invalid registration data payload: ${clientMsg.data}. Error: ${errorMsg}`);
                    ws.send(JSON.stringify({
                        type: 'reg',
                        data: JSON.stringify({ name: '', index: '', error: true, errorText: `Invalid registration data: ${errorMsg}` }),
                        id: clientMsg.id || 0
                    }));
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
                handleCreateRoom(ws, wss, currentPlayerId, clientMsg.id, connectionId);
                break;
            case 'add_user_to_room':
                console.log(`[${connectionId}] Placeholder for add_user_to_room. PlayerID: ${currentPlayerId}`);
                // Тут буде виклик handleAddUserToRoom
                break;
            default:
                console.warn(`[${connectionId}] Unknown message type: ${clientMsg.type}`);
                ws.send(JSON.stringify({
                    type: 'error',
                    data: JSON.stringify({ message: `Unknown command type: ${clientMsg.type}` }),
                    id: clientMsg.id
                }));
        }
    });

    ws.on('close', () => {
        const closedPlayerId = getPlayerIdFromWs(ws);
        console.log(`[${connectionId}] Connection closed. Player ID: ${closedPlayerId || 'N/A'}`);

        if (closedPlayerId) {
            removePlayerFromRooms(closedPlayerId);

            const availableRooms = gameRoomsDB
                .filter(room => room.roomUsers.length === 1)
                .map(room => ({
                    roomId: room.roomId,
                    roomUsers: room.roomUsers.map(u => ({name: u.name, index: u.index}))
                }));
            broadcastToAll(wss, { type: "update_room", data: JSON.stringify(availableRooms), id: 0 });
            console.log(`[Broadcast] Sent 'update_room' after player ${closedPlayerId} disconnected.`);

            delete (ws as any).playerId;
        }
    });

    ws.on('error', (error: Error) => {
        console.error(`[${connectionId}] WebSocket error for client: ${error.message}`);
    });
});

wss.on('error', (error: Error) => {
    console.error(`WebSocketServer global error: ${error.message}`);
});

wss.on('close', () => {
    console.log('WebSocketServer has closed.');
});

const shutdown = () => {
    console.log('Shutting down WebSocket server...');
    wss.clients.forEach((client) => {
        client.terminate();
    });
    wss.close((err) => {
        if (err) {
            console.error('Error closing WebSocket server:', err);
        } else {
            console.log('WebSocket server closed successfully.');
        }
        process.exit(err ? 1 : 0);
    });
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 5000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
