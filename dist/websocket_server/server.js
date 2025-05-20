import { WebSocketServer, WebSocket } from 'ws';
import { authHandlerInstance } from './modules/auth/auth.handler.js';
import { roomHandlerInstance } from './modules/room/room.handler.js';
import { gameHandlerInstance } from './modules/game/game.handler.js';
import { generateConnectionId } from './core/wsUtils.js';
import { broadcastToAll } from './core/wsUtils.js';
import { gameRoomsDB, updateWinners, winnersDB } from "./db.js";
import { playerRepositoryInstance } from "./modules/player/player.repository.js";
const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: Number(PORT) });
console.log(`WebSocket server started on ws://localhost:${PORT}`);
const getPlayerIdFromWs = (socket) => {
    return socket.playerId;
};
wss.on('connection', (ws, req) => {
    const connectionId = generateConnectionId();
    const clientIp = req.socket.remoteAddress || 'N/A';
    console.log(`[${connectionId}] New connection established from IP: ${clientIp}`);
    ws.on('message', (message) => {
        const currentPlayerId = getPlayerIdFromWs(ws);
        let clientMsg;
        const messageString = message.toString();
        try {
            clientMsg = JSON.parse(messageString);
        }
        catch (err) {
            console.error(`[${connectionId}] Invalid JSON received: ${messageString}`);
            ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'Invalid JSON format.' }), id: 0 }));
            return;
        }
        const dataPreview = typeof clientMsg.data === 'string' ?
            (clientMsg.data.length > 70 ? clientMsg.data.substring(0, 70) + '...' : clientMsg.data) :
            '[Object data]';
        console.log(`[${connectionId}] Rcvd cmd: type=${clientMsg.type}, id=${clientMsg.id}, pId=${currentPlayerId || 'N/A'}, data='${dataPreview}'`);
        try {
            switch (clientMsg.type) {
                case 'reg':
                    let regData;
                    try {
                        if (typeof clientMsg.data !== 'string')
                            throw new Error('Registration data is not a string');
                        regData = JSON.parse(clientMsg.data);
                        if (!regData.name || !regData.password)
                            throw new Error('Name or password missing in registration data');
                    }
                    catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Unknown error parsing reg data';
                        console.error(`[${connectionId}] Invalid registration data payload: ${clientMsg.data}. Error: ${errorMsg}`);
                        ws.send(JSON.stringify({
                            type: 'reg',
                            data: JSON.stringify({ name: '', index: '', error: true, errorText: `Invalid registration data: ${errorMsg}` }),
                            id: clientMsg.id || 0
                        }));
                        return;
                    }
                    authHandlerInstance.handleRegistration(ws, wss, regData, clientMsg.id || 0, connectionId);
                    break;
                case 'create_room':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'create_room' attempt (player not registered/identified).`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: 'User not authenticated to create room.' }),
                            id: clientMsg.id || 0
                        }));
                        return;
                    }
                    roomHandlerInstance.handleCreateRoom(ws, wss, currentPlayerId, clientMsg.id || 0, connectionId);
                    break;
                case 'add_user_to_room':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'add_user_to_room' attempt (player not registered/identified).`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: 'User not authenticated to join room.' }),
                            id: clientMsg.id || 0
                        }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string')
                            throw new Error('Data for add_user_to_room must be a JSON string.');
                        const addUserToRoomData = JSON.parse(clientMsg.data);
                        if (!addUserToRoomData || typeof addUserToRoomData.indexRoom !== 'string' || addUserToRoomData.indexRoom.trim() === '') {
                            throw new Error('indexRoom is missing, not a string, or empty in add_user_to_room data.');
                        }
                        roomHandlerInstance.handleAddUserToRoom(ws, wss, currentPlayerId, addUserToRoomData, clientMsg.id || 0, connectionId);
                    }
                    catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing add_user_to_room data payload';
                        console.error(`[${connectionId}] Error parsing 'add_user_to_room' data payload: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data format for add_user_to_room: ${errorMsg}` }),
                            id: clientMsg.id || 0,
                        }));
                    }
                    break;
                case 'add_ships':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'add_ships' attempt.`);
                        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'User not authenticated for add_ships' }), id: clientMsg.id || 0 }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string')
                            throw new Error('Data for add_ships must be a JSON string.');
                        const addShipsData = JSON.parse(clientMsg.data);
                        if (!addShipsData.gameId || !Array.isArray(addShipsData.ships) || !addShipsData.indexPlayer) {
                            throw new Error('Invalid payload for add_ships: gameId, ships array, and indexPlayer are required.');
                        }
                        if (addShipsData.indexPlayer !== currentPlayerId) {
                            console.warn(`[${connectionId}] Mismatched playerId for add_ships. Authenticated: ${currentPlayerId}, Sent: ${addShipsData.indexPlayer}. Denying request.`);
                            throw new Error('Player ID in add_ships data does not match authenticated player.');
                        }
                        gameHandlerInstance.handleAddShips(ws, wss, addShipsData, clientMsg.id || 0, connectionId);
                    }
                    catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing/validating add_ships data payload';
                        console.error(`[${connectionId}] Error in 'add_ships' processing: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data or error in add_ships: ${errorMsg}` }),
                            id: clientMsg.id || 0,
                        }));
                    }
                    break;
                case 'attack':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'attack' attempt.`);
                        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'User not authenticated for attack' }), id: clientMsg.id || 0 }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string')
                            throw new Error('Data for attack must be a JSON string.');
                        const attackData = JSON.parse(clientMsg.data);
                        if (attackData.indexPlayer !== currentPlayerId) {
                            console.warn(`[${connectionId}] Mismatched playerId for attack. Authenticated: ${currentPlayerId}, Sent: ${attackData.indexPlayer}. Denying request.`);
                            throw new Error('Player ID in attack data does not match authenticated player.');
                        }
                        if (typeof attackData.x !== 'number' || typeof attackData.y !== 'number' || !attackData.gameId) {
                            throw new Error('Invalid payload for attack: gameId, x (number), and y (number) are required.');
                        }
                        gameHandlerInstance.handleAttack(ws, wss, attackData, clientMsg.id || 0, connectionId);
                    }
                    catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing/validating attack data payload';
                        console.error(`[${connectionId}] Error in 'attack' processing: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data or error in attack: ${errorMsg}` }),
                            id: clientMsg.id || 0,
                        }));
                    }
                    break;
                case 'single_play':
                    if (!currentPlayerId) {
                        console.warn(`[${connectionId}] Unauthorized 'randomAttack' attempt.`);
                        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'User not authenticated for randomAttack' }), id: clientMsg.id || 0 }));
                        return;
                    }
                    try {
                        if (typeof clientMsg.data !== 'string')
                            throw new Error('Data for randomAttack must be a JSON string.');
                        const randomAttackData = JSON.parse(clientMsg.data);
                        if (randomAttackData.indexPlayer !== currentPlayerId) {
                            console.warn(`[${connectionId}] Mismatched playerId for randomAttack. Authenticated: ${currentPlayerId}, Sent: ${randomAttackData.indexPlayer}. Denying request.`);
                            throw new Error('Player ID in randomAttack data does not match authenticated player.');
                        }
                        if (!randomAttackData.gameId) {
                            throw new Error('Invalid payload for randomAttack: gameId is required.');
                        }
                        gameHandlerInstance.handleRandomAttack(ws, wss, randomAttackData, clientMsg.id || 0, connectionId);
                    }
                    catch (e) {
                        const errorMsg = e instanceof Error ? e.message : 'Error parsing/validating randomAttack data payload';
                        console.error(`[${connectionId}] Error in 'randomAttack' processing: ${errorMsg}. Payload string: ${clientMsg.data}`);
                        ws.send(JSON.stringify({
                            type: 'error',
                            data: JSON.stringify({ message: `Invalid data or error in randomAttack: ${errorMsg}` }),
                            id: clientMsg.id || 0,
                        }));
                    }
                    break;
                default:
                    console.warn(`[${connectionId}] Unknown message type received: ${clientMsg.type}`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: JSON.stringify({ message: `Unknown command type: ${clientMsg.type}` }),
                        id: clientMsg.id || 0
                    }));
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during command processing';
            console.error(`[${connectionId}] Critical error processing command ${clientMsg?.type}: ${errorMessage}`, error.stack);
            ws.send(JSON.stringify({
                type: 'error',
                data: JSON.stringify({ message: `Server error while processing ${clientMsg?.type}: ${errorMessage}` }),
                id: clientMsg?.id || 0,
            }));
        }
    });
    ws.on('close', (code, reason) => {
        const closedPlayerId = getPlayerIdFromWs(ws);
        const reasonString = reason ? reason.toString() : 'No reason provided';
        console.log(`[${connectionId}] Connection closed. Player ID: ${closedPlayerId || 'N/A'}, Code: ${code}, Reason: ${reasonString}`);
        if (closedPlayerId) {
            const roomContainingPlayer = gameRoomsDB.find(room => room.roomUsers.some(user => user.index === closedPlayerId) && room.isGameActive);
            gameHandlerInstance.removePlayerFromRooms(closedPlayerId);
            if (roomContainingPlayer) {
                roomContainingPlayer.isGameActive = false;
                const opponent = roomContainingPlayer.roomUsers.find(user => user.index !== closedPlayerId);
                if (opponent) {
                    const opponentPlayerDetails = playerRepositoryInstance.findById(opponent.index);
                    if (opponentPlayerDetails) {
                        updateWinners(opponentPlayerDetails.name);
                        console.log(`[${connectionId}] Player ${opponentPlayerDetails.name} (${opponent.index}) wins by default as ${closedPlayerId} disconnected from game ${roomContainingPlayer.roomId}.`);
                    }
                    const finishPayload = { winPlayer: opponent.index };
                    let opponentWs;
                    wss.clients.forEach(client => {
                        if (getPlayerIdFromWs(client) === opponent.index) {
                            opponentWs = client;
                        }
                    });
                    if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
                        opponentWs.send(JSON.stringify({ type: 'finish', data: JSON.stringify(finishPayload), id: 0 }));
                        console.log(`[${connectionId}] Sent 'finish' to opponent ${opponent.index} as player ${closedPlayerId} disconnected.`);
                    }
                    const winnersPayload = [...winnersDB];
                    broadcastToAll(wss, { type: "update_winners", data: JSON.stringify(winnersPayload), id: 0 });
                    console.log(`[Broadcast] Sent 'update_winners' after player ${closedPlayerId} disconnected.`);
                }
            }
            const availableRooms = gameRoomsDB
                .filter(room => room.roomUsers.length === 1 && !room.isGameActive)
                .map(room => ({
                roomId: room.roomId,
                roomUsers: room.roomUsers.map(u => ({ name: u.name, index: u.index }))
            }));
            broadcastToAll(wss, { type: "update_room", data: JSON.stringify(availableRooms), id: 0 });
            console.log(`[Broadcast] Sent 'update_room' after player ${closedPlayerId} disconnected or game ended.`);
            delete ws.playerId;
        }
    });
    ws.on('error', (error) => {
        console.error(`[${connectionId}] WebSocket error for client (Player ID: ${getPlayerIdFromWs(ws) || 'N/A'}): ${error.message}`, error.stack);
    });
});
wss.on('error', (error) => {
    console.error(`WebSocketServer global error: ${error.message}`, error.stack);
});
wss.on('close', () => {
    console.log('WebSocketServer has closed gracefully.');
});
const shutdown = () => {
    console.log('Shutting down WebSocket server...');
    wss.clients.forEach((client) => {
        client.close(1001, 'Server is shutting down.');
    });
    wss.close((err) => {
        if (err) {
            console.error('Error closing WebSocket server:', err);
        }
        else {
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
