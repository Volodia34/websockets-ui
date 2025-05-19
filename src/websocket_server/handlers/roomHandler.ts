import { WebSocket, WebSocketServer } from 'ws';
import { Player, GameRoom, GameRoomUser, AddUserToRoomClientData } from '../types.js';
import { gameRoomsDB, getNextRoomId, findPlayerById, addRoom } from '../db.js';
import { broadcastToAll } from '../utils.js';

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
        roomUsers: [creator]
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
    console.log(`[${connectionId}] handleAddUserToRoom called by PlayerID: ${joiningPlayerId} for RoomID: ${clientData.indexRoom}. Implementation pending.`);
}
