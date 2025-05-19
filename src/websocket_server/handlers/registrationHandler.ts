import { WebSocket, WebSocketServer } from 'ws';
import { Winner, GameRoom, RegClientData, RegResponseData,  } from '../types.js';
import { playerRepositoryInstance } from '../modules/player/player.repository.js';
import { winnersDB, gameRoomsDB } from '../db.js';
import { broadcastToAll } from '../wsUntils.js';
import {Player} from "../modules/player/player.types.js";


export function handleRegistration(
    ws: WebSocket,
    wss: WebSocketServer,
    regClientData: RegClientData,
    messageId: number,
    connectionId: string
): void {
    const { name: playerName, password: playerPassword } = regClientData;

    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '' ||
        !playerPassword || typeof playerPassword !== 'string' || playerPassword.trim() === '') {
        const errorResponsePayload: RegResponseData = {
            name: playerName || '',
            index: '',
            error: true,
            errorText: 'Name and password are required and cannot be empty.',
        };
        ws.send(JSON.stringify({
            type: 'reg',
            data: JSON.stringify(errorResponsePayload),
            id: messageId,
        }));
        return;
    }

    let existingPlayer = playerRepositoryInstance.findByName(playerName);
    let responseDataPayload: RegResponseData;

    if (existingPlayer) {
        if (existingPlayer.password === playerPassword) {
            (ws as any).playerId = existingPlayer.id;
            console.log(`[${connectionId}] Player ${playerName} (ID: ${existingPlayer.id}) logged in. Associated ws with playerId: ${existingPlayer.id}`);
            responseDataPayload = {
                name: existingPlayer.name,
                index: existingPlayer.id,
                error: false,
                errorText: '',
            };
        } else {
            console.log(`[${connectionId}] Incorrect password for player ${playerName}.`);
            responseDataPayload = {
                name: playerName,
                index: '',
                error: true,
                errorText: 'Incorrect password',
            };
        }
    } else {
        const newPlayerId = playerRepositoryInstance.getNextUserIndex();
        const newPlayer: Player = {
            id: newPlayerId,
            name: playerName,
            password: playerPassword,
        };
        playerRepositoryInstance.addPlayer(newPlayer);
        (ws as any).playerId = newPlayer.id;
        console.log(`[${connectionId}] Player ${playerName} registered with ID ${newPlayer.id}. Associated ws with playerId: ${newPlayer.id}`);
        responseDataPayload = {
            name: newPlayer.name,
            index: newPlayer.id,
            error: false,
            errorText: '',
        };
    }

    ws.send(JSON.stringify({
        type: 'reg',
        data: JSON.stringify(responseDataPayload),
        id: messageId,
    }));

    if (!responseDataPayload.error) {
        const winnersPayload: Winner[] = [...winnersDB];
        const updateWinnersMessage = {
            type: "update_winners",
            data: JSON.stringify(winnersPayload),
            id: 0,
        };
        broadcastToAll(wss, updateWinnersMessage);
        console.log(`[Broadcast] Sent 'update_winners'. Data:`, winnersPayload);

        const roomsForUpdate: Partial<GameRoom>[] = gameRoomsDB
            .filter(room => room.roomUsers.length === 1)
            .map(room => ({
                roomId: room.roomId,
                roomUsers: room.roomUsers.map(user => ({ name: user.name, index: user.index }))
            }));
        const updateRoomMessage = {
            type: "update_room",
            data: JSON.stringify(roomsForUpdate),
            id: 0,
        };
        broadcastToAll(wss, updateRoomMessage);
        console.log(`[Broadcast] Sent 'update_room'. Data:`, roomsForUpdate);
    }
}
