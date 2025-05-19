import { WebSocket, WebSocketServer } from 'ws';
import {
    GameRoom,
    GameRoomUser,
    AddUserToRoomClientData,
    CreateGameResponseData
} from '../types.js';
import {
    gameRoomsDB,
    getNextRoomId,
    findPlayerById,
    addRoom,
    findRoomById
} from '../db.js';
import { broadcastToAll } from '../wsUntils.js';

export function handleCreateRoom(
    ws: WebSocket,
    wss: WebSocketServer,
    requestingPlayerId: string,
    messageId: number,
    connectionId: string
): void {
    const player = findPlayerById(requestingPlayerId);

    if (!player) {
        console.error(`[${connectionId}] CRITICAL: Player with ID ${requestingPlayerId} not found for create_room.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'Authentication error: Player not found.' }),
            id: messageId
        }));
        return;
    }

    const alreadyInRoom = gameRoomsDB.find(room => room.roomUsers.some(user => user.index === requestingPlayerId));
    if (alreadyInRoom) {
        console.log(`[${connectionId}] Player ${player.name} (ID: ${requestingPlayerId}) is already in room ${alreadyInRoom.roomId}. Cannot create new room.`);
        const roomsForUpdate = gameRoomsDB
            .filter(r => r.roomUsers.length === 1)
            .map(r => ({
                roomId: r.roomId,
                roomUsers: r.roomUsers.map(u => ({name: u.name, index: u.index}))
            }));
        broadcastToAll(wss, { type: "update_room", data: JSON.stringify(roomsForUpdate), id: 0 });
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'You are already in a room. Cannot create a new one.' }),
            id: messageId
        }));
        return;
    }

    const newRoomId = getNextRoomId();
    const creator: GameRoomUser = { name: player.name, index: player.id };
    const newRoom: GameRoom = {
        roomId: newRoomId,
        roomUsers: [creator],
        shipsReadyCount: 0,
        player1Ships: null,
        player2Ships: null,
        currentPlayerTurn: null,
    };

    addRoom(newRoom);
    console.log(`[${connectionId}] Player ${player.name} (ID: ${requestingPlayerId}) created room ${newRoomId}.`);

    const availableRooms = gameRoomsDB
        .filter(room => room.roomUsers.length === 1)
        .map(room => ({
            roomId: room.roomId,
            roomUsers: room.roomUsers.map(user => ({ name: user.name, index: user.index }))
        }));

    const updateRoomMessage = {
        type: "update_room",
        data: JSON.stringify(availableRooms),
        id: 0
    };
    broadcastToAll(wss, updateRoomMessage);
    console.log(`[${connectionId}] Broadcast 'update_room' after room creation. Data:`, availableRooms);
}

export function handleAddUserToRoom(
    ws: WebSocket,
    wss: WebSocketServer,
    joiningPlayerId: string,
    clientData: AddUserToRoomClientData,
    messageId: number,
    connectionId: string
): void {
    const joiningPlayer = findPlayerById(joiningPlayerId);
    if (!joiningPlayer) {
        console.error(`[${connectionId}] Joining player with ID ${joiningPlayerId} not found.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'Authentication error: Your player ID was not found.' }),
            id: messageId
        }));
        return;
    }

    const targetRoomId = clientData.indexRoom;
    const foundRoom = findRoomById(targetRoomId);

    if (!foundRoom) {
        console.warn(`[${connectionId}] Room ${targetRoomId} not found for player ${joiningPlayer.name} (ID: ${joiningPlayerId}).`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: `Room with ID ${targetRoomId} not found.` }),
            id: messageId
        }));
        return;
    }

    if (foundRoom.roomUsers.some(user => user.index === joiningPlayerId)) {
        console.log(`[${connectionId}] Player ${joiningPlayer.name} (ID: ${joiningPlayerId}) is already in room ${targetRoomId}.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'You are already in this room.' }),
            id: messageId
        }));
        return;
    }

    if (foundRoom.roomUsers.length >= 2) {
        console.log(`[${connectionId}] Room ${targetRoomId} is already full. Player ${joiningPlayer.name} (ID: ${joiningPlayerId}) cannot join.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'The room is already full.' }),
            id: messageId
        }));
        const currentAvailableRooms = gameRoomsDB
            .filter(room => room.roomUsers.length === 1)
            .map(room => ({ roomId: room.roomId, roomUsers: room.roomUsers.map(u => ({name: u.name, index: u.index})) }));
        broadcastToAll(wss, { type: "update_room", data: JSON.stringify(currentAvailableRooms), id: 0 });
        return;
    }

    if (foundRoom.roomUsers.length === 0) {
        console.warn(`[${connectionId}] Room ${targetRoomId} was empty. Player ${joiningPlayer.name} (ID: ${joiningPlayerId}) will become the first player.`);
        foundRoom.roomUsers.push({ name: joiningPlayer.name, index: joiningPlayer.id });
        const roomsAfterJoin = gameRoomsDB
            .filter(room => room.roomUsers.length === 1)
            .map(room => ({ roomId: room.roomId, roomUsers: room.roomUsers.map(u => ({name: u.name, index: u.index})) }));
        broadcastToAll(wss, { type: "update_room", data: JSON.stringify(roomsAfterJoin), id: 0 });
        console.log(`[Broadcast] Sent 'update_room' after player ${joiningPlayer.name} joined an empty room. Data:`, roomsAfterJoin);
        return;
    }

    foundRoom.roomUsers.push({ name: joiningPlayer.name, index: joiningPlayer.id });
    console.log(`[${connectionId}] Player ${joiningPlayer.name} (ID: ${joiningPlayerId}) successfully joined room ${foundRoom.roomId}.`);
    console.log(`[${connectionId}] Room ${foundRoom.roomId} users:`, foundRoom.roomUsers.map(u => u.name));

    if (foundRoom.roomUsers.length === 2) {
        foundRoom.shipsReadyCount = 0;
        foundRoom.player1Ships = null;
        foundRoom.player2Ships = null;
        foundRoom.currentPlayerTurn = null;

        foundRoom.roomUsers.forEach(userInRoom => {
            const createGamePayload: CreateGameResponseData = {
                idGame: foundRoom.roomId,
                idPlayer: userInRoom.index
            };

            let targetWs: WebSocket | undefined;
            wss.clients.forEach((clientWs: WebSocket) => {
                if ((clientWs as any).playerId === userInRoom.index) {
                    targetWs = clientWs;
                }
            });

            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                    type: "create_game",
                    data: JSON.stringify(createGamePayload),
                    id: 0
                }));
                console.log(`[${connectionId}] Sent 'create_game' to player ${userInRoom.name} (ID: ${userInRoom.index}) for game ${foundRoom.roomId}`);
            } else {
                console.warn(`[${connectionId}] Could not find active WebSocket for player ${userInRoom.name} (ID: ${userInRoom.index}) to send 'create_game'.`);
            }
        });
    }

    const availableRoomsNow = gameRoomsDB
        .filter(room => room.roomUsers.length === 1)
        .map(room => ({
            roomId: room.roomId,
            roomUsers: room.roomUsers.map(user => ({ name: user.name, index: user.index }))
        }));

    broadcastToAll(wss, {
        type: "update_room",
        data: JSON.stringify(availableRoomsNow),
        id: 0
    });
    console.log(`[Broadcast] Sent 'update_room' after player ${joiningPlayer.name} joined room ${foundRoom.roomId}. Available rooms:`, availableRoomsNow);
}
