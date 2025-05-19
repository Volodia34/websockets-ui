import { WebSocket, WebSocketServer } from 'ws';
import { RoomService, roomServiceInstance } from './room.service.js';
import { AddUserToRoomClientData, CreateGameResponseData, GameRoomUser } from './room.types.js';
import {broadcastToAll} from "../../core/wsUtils.js";

export class RoomHandler {
    constructor(private roomService: RoomService) {}

    public handleCreateRoom(
        ws: WebSocket,
        wss: WebSocketServer,
        requestingPlayerId: string,
        messageId: number,
        connectionId: string
    ): void {
        const result = this.roomService.createRoom(requestingPlayerId, connectionId);

        if (!result.success) {
            ws.send(JSON.stringify({
                type: 'error',
                data: JSON.stringify({ message: result.message }),
                id: messageId
            }));
            if (result.updatedAvailableRooms) {
                broadcastToAll(wss, {
                    type: "update_room",
                    data: JSON.stringify(result.updatedAvailableRooms),
                    id: 0
                });
            }
            return;
        }

        if (result.updatedAvailableRooms) {
            const updateRoomMessage = {
                type: "update_room",
                data: JSON.stringify(result.updatedAvailableRooms),
                id: 0
            };
            broadcastToAll(wss, updateRoomMessage);
            console.log(`[Broadcast][${connectionId}] Sent 'update_room' after room creation. Rooms:`, result.updatedAvailableRooms.length);
        }
        ws.send(JSON.stringify({ type: 'room_created', data: JSON.stringify({ roomId: result.data?.roomId }), id: messageId }));
    }

    public handleAddUserToRoom(
        ws: WebSocket,
        wss: WebSocketServer,
        joiningPlayerId: string,
        clientData: AddUserToRoomClientData,
        messageId: number,
        connectionId: string
    ): void {
        const result = this.roomService.addUserToRoom(joiningPlayerId, clientData.indexRoom, connectionId);

        if (!result.success) {
            ws.send(JSON.stringify({
                type: 'error',
                data: JSON.stringify({ message: result.message }),
                id: messageId
            }));
            if (result.updatedAvailableRooms) {
                broadcastToAll(wss, {
                    type: "update_room",
                    data: JSON.stringify(result.updatedAvailableRooms),
                    id: 0
                });
            }
            return;
        }

        if (result.updatedAvailableRooms) {
            broadcastToAll(wss, {
                type: "update_room",
                data: JSON.stringify(result.updatedAvailableRooms),
                id: 0
            });
            console.log(`[Broadcast][${connectionId}] Sent 'update_room' after player ${joiningPlayerId} joined room ${clientData.indexRoom}.`);
        }

        if (result.gameCreationData) {
            const { gameId, usersToNotify } = result.gameCreationData;
            usersToNotify.forEach(userInRoom => {
                const createGamePayload: CreateGameResponseData = {
                    idGame: gameId,
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
                    console.log(`[${connectionId}] Sent 'create_game' to player ${userInRoom.name} (ID: ${userInRoom.index}) for game ${gameId}`);
                } else {
                    console.warn(`[${connectionId}] Could not find active WebSocket for player ${userInRoom.name} (ID: ${userInRoom.index}) to send 'create_game'.`);
                }
            });
        }
    }
}

export const roomHandlerInstance = new RoomHandler(roomServiceInstance);
