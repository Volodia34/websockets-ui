import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'node:http';
import {
    ClientMessage,
    RegClientData,
    AddUserToRoomClientData,
    AddShipsClientData,
    AttackClientData,
    FinishResponseData, Winner
} from './types.js';
import { handleRegistration } from './handlers/registrationHandler.js';
import { handleCreateRoom, handleAddUserToRoom } from './handlers/roomHandler.js';
import { handleAddShips, handleAttack, handleRandomAttack } from './handlers/gameHandler.js';
import { generateConnectionId } from './utils.js';
import {findPlayerById, gameRoomsDB, removePlayerFromRooms, updateWinners, winnersDB} from './db.js';
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
            ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'Invalid JSON format.' }), id: 0 }));
            return;
        }

        console.log(`[${connectionId}] Rcvd cmd: type=${clientMsg.type}, id=${clientMsg.id}, pId=${currentPlayerId || 'N/A'}, dataLen=${clientMsg.data?.length}`);

        try {
            switch (clientMsg.type) {
                case 'reg':
                    let regData: RegClientData;
                    try {
                        if (typeof clientMsg.data !== 'string') throw new Error('Registration data is not a string');
                        regData = JSON.parse(clientMsg.data);
                        if (!regData.name || !regData.password) throw new Error('Name or password missing in registration data');
                    } catch (e) {
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
                            data: JSON.stringify({ message: 'User not authenticated to create room.' }),
                            id: clientMsg.id
                        }));
                        return;
                    }
                    handleCreateRoom(ws, wss, currentPlayerId, clientMsg.id, connectionId);
                    break;
                case 'add_user_to_room':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'add_user_to_room' attempt.`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: 'User not authenticated to join room.' }),
                            id: clientMsg.id
                        }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string') throw new Error('Data for add_user_to_room must be a JSON string.');
                        const addUserToRoomData: AddUserToRoomClientData = JSON.parse(clientMsg.data);
                        if (!addUserToRoomData || typeof addUserToRoomData.indexRoom !== 'string' || addUserToRoomData.indexRoom.trim() === '') {
                            throw new Error('indexRoom is missing, not a string, or empty in add_user_to_room data.');
                        }
                        handleAddUserToRoom(ws, wss, currentPlayerId, addUserToRoomData, clientMsg.id, connectionId);
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing add_user_to_room data payload';
                        console.error(`[${connectionId}] Error parsing 'add_user_to_room' data payload: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data format for add_user_to_room: ${errorMsg}` }),
                            id: clientMsg.id,
                        }));
                    }
                    break;
                case 'add_ships':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'add_ships' attempt.`);
                        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({message: 'User not authenticated for add_ships'}), id: clientMsg.id }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string') throw new Error('Data for add_ships must be a JSON string.');
                        const addShipsData: AddShipsClientData = JSON.parse(clientMsg.data);
                        if (!addShipsData.gameId || !Array.isArray(addShipsData.ships) || !addShipsData.indexPlayer) {
                            throw new Error('Invalid payload for add_ships: gameId, ships array, and indexPlayer are required.');
                        }
                        if (addShipsData.indexPlayer !== currentPlayerId) {
                            console.warn(`[${connectionId}] Mismatched playerId for add_ships. Authenticated: ${currentPlayerId}, Sent: ${addShipsData.indexPlayer}`);
                            throw new Error('Player ID in add_ships data does not match authenticated player.');
                        }
                        handleAddShips(ws, wss, addShipsData, clientMsg.id, connectionId);
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing/validating add_ships data payload';
                        console.error(`[${connectionId}] Error in 'add_ships' processing: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data or error in add_ships: ${errorMsg}` }),
                            id: clientMsg.id,
                        }));
                    }
                    break;
                case 'attack':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'attack' attempt.`);
                        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({message: 'User not authenticated for attack'}), id: clientMsg.id }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string') throw new Error('Data for attack must be a JSON string.');
                        const attackData: AttackClientData = JSON.parse(clientMsg.data);
                        if (attackData.indexPlayer !== currentPlayerId) {
                            console.warn(`[${connectionId}] Mismatched playerId for attack. Authenticated: ${currentPlayerId}, Sent: ${attackData.indexPlayer}`);
                            throw new Error('Player ID in attack data does not match authenticated player.');
                        }
                        if (typeof attackData.x !== 'number' || typeof attackData.y !== 'number' || !attackData.gameId) {
                            throw new Error('Invalid payload for attack: gameId, x, and y are required.');
                        }
                        handleAttack(ws, wss, attackData, clientMsg.id, connectionId);
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing/validating attack data payload';
                        console.error(`[${connectionId}] Error in 'attack' processing: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data or error in attack: ${errorMsg}` }),
                            id: clientMsg.id,
                        }));
                    }
                    break;
                case 'randomAttack':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'randomAttack' attempt.`);
                        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({message: 'User not authenticated for randomAttack'}), id: clientMsg.id }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string') throw new Error('Data for randomAttack must be a JSON string.');
                        const randomAttackData: { gameId: string; indexPlayer: string } = JSON.parse(clientMsg.data);
                        if (randomAttackData.indexPlayer !== currentPlayerId) {
                            console.warn(`[${connectionId}] Mismatched playerId for randomAttack. Authenticated: ${currentPlayerId}, Sent: ${randomAttackData.indexPlayer}`);
                            throw new Error('Player ID in randomAttack data does not match authenticated player.');
                        }
                        if (!randomAttackData.gameId) {
                            throw new Error('Invalid payload for randomAttack: gameId is required.');
                        }
                        handleRandomAttack(ws, wss, randomAttackData, clientMsg.id, connectionId);
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing/validating randomAttack data payload';
                        console.error(`[${connectionId}] Error in 'randomAttack' processing: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data or error in randomAttack: ${errorMsg}` }),
                            id: clientMsg.id,
                        }));
                    }
                    break;
                default:
                    console.warn(`[${connectionId}] Unknown message type: ${clientMsg.type}`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: JSON.stringify({ message: `Unknown command type: ${clientMsg.type}` }),
                        id: clientMsg.id
                    }));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during command processing';
            console.error(`[${connectionId}] Error processing command ${clientMsg?.type}: ${errorMessage}`);
            ws.send(JSON.stringify({
                type: 'error',
                data: JSON.stringify({ message: `Server error while processing ${clientMsg?.type}: ${errorMessage}` }),
                id: clientMsg?.id || 0,
            }));
        }
    });

    ws.on('close', (code, reason) => {
        const closedPlayerId = getPlayerIdFromWs(ws);
        console.log(`[${connectionId}] Connection closed. Player ID: ${closedPlayerId || 'N/A'}, Code: ${code}, Reason: ${reason.toString()}`);

        if (closedPlayerId) {
            const roomContainingPlayer = gameRoomsDB.find(room => room.roomUsers.some(user => user.index === closedPlayerId) && room.isGameActive);

            removePlayerFromRooms(closedPlayerId);

            if (roomContainingPlayer) {
                roomContainingPlayer.isGameActive = false;
                const opponent = roomContainingPlayer.roomUsers.find(user => user.index !== closedPlayerId);
                if (opponent) {
                    const opponentPlayerDetails = findPlayerById(opponent.index);
                    const finishPayload: FinishResponseData = { winPlayer: opponent.index };
                    if(opponentPlayerDetails) updateWinners(opponentPlayerDetails.name);


                    let opponentWs: WebSocket | undefined;
                    wss.clients.forEach(client => { if ((client as any).playerId === opponent.index) opponentWs = client; });
                    if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                        opponentWs.send(JSON.stringify({ type: 'finish', data: JSON.stringify(finishPayload), id: 0 }));
                        console.log(`[${connectionId}] Sent 'finish' to opponent ${opponent.index} as player ${closedPlayerId} disconnected.`);
                    }
                    const winnersPayload: Winner[] = [...winnersDB];
                    broadcastToAll(wss, { type: "update_winners", data: JSON.stringify(winnersPayload), id: 0 });
                }
            }

            const availableRooms = gameRoomsDB
                .filter(room => room.roomUsers.length === 1 && !room.isGameActive)
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
