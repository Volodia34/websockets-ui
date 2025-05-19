import { WebSocket, WebSocketServer } from 'ws';
import { GameService, gameServiceInstance } from './game.service.js';
import {
    AddShipsClientData,
    AttackClientData,
    AttackResponseData,
    StartGameDataToClient,
    TurnDataToClient
} from './game.types.js';
import { broadcastToAll } from '../../core/wsUtils.js';
import {roomServiceInstance} from "../room/room.service.js";

export class GameHandler {
    constructor(private gameService: GameService) {}

    public handleAddShips(
        ws: WebSocket,
        wss: WebSocketServer,
        clientData: AddShipsClientData,
        messageId: number,
        connectionId: string
    ): void {
        console.log(`[${connectionId}] Handling add_ships for game ${clientData.gameId} by player ${clientData.indexPlayer}`);

        const result = this.gameService.addShips(clientData, connectionId);

        if (result.room && result.gameCanStart && result.startGameData) {
            const room = result.room;

            const player1 = room.roomUsers[0];
            const player2 = room.roomUsers[1];

            const wsPlayer1 = Array.from(wss.clients as Set<WebSocket & {playerId: string}>).find(client => client.playerId === player1.index);
            const wsPlayer2 = Array.from(wss.clients as Set<WebSocket & {playerId: string}>).find(client => client.playerId === player2.index);

            if (wsPlayer1 && result.startGameData.player1) {
                wsPlayer1.send(JSON.stringify({
                    type: "start_game",
                    data: JSON.stringify(result.startGameData.player1),
                    id: 0
                }));
                console.log(`[${connectionId}] Sent start_game to ${player1.name}`);
            }
            if (wsPlayer2 && result.startGameData.player2) {
                wsPlayer2.send(JSON.stringify({
                    type: "start_game",
                    data: JSON.stringify(result.startGameData.player2),
                    id: 0
                }));
                console.log(`[${connectionId}] Sent start_game to ${player2.name}`);
            }

            const turnUpdateData = {
                type: "turn",
                data: JSON.stringify({ currentPlayer: room.currentPlayerTurn, gameId: room.roomId }),
                id: 0
            };
            broadcastToAll(wss, turnUpdateData);
            console.log(`[${connectionId}] Broadcast turn update, current player: ${room.currentPlayerTurn}`);


        } else if(result.room) {
            console.log(`[${connectionId}] Ships added by ${clientData.indexPlayer}, waiting for other player. Ships ready: ${result.room.shipsReadyCount}`);
            ws.send(JSON.stringify({
                type: "ships_accepted",
                data: JSON.stringify({ gameId: clientData.gameId, playerId: clientData.indexPlayer }),
                id: messageId
            }));
        } else {
            console.error(`[${connectionId}] Failed to process add_ships for game ${clientData.gameId}`);
            ws.send(JSON.stringify({
                type: "error",
                data: JSON.stringify({ message: "Failed to add ships. Room not found or not ready."}),
                id: messageId
            }));
        }
    }

    public handleAttack(
        ws: WebSocket,
        wss: WebSocketServer,
        clientData: AttackClientData,
        messageId: number,
        connectionId: string
    ): void {
        console.log(`[${connectionId}] Handling attack in game ${clientData.gameId} by player <span class="math-inline">\{clientData\.indexPlayer\} on \[</span>{clientData.x}, ${clientData.y}]`);

        const result = this.gameService.attack(clientData, connectionId);

        if (!result.success || !result.attackResult) {
            console.error(`[${connectionId}] Attack failed: ${result.message}`);
            ws.send(JSON.stringify({
                type: 'error',
                data: JSON.stringify({ message: result.message || "Attack failed." }),
                id: messageId
            }));
            return;
        }

        const room = result.room;
        if (room) {
            const attackResponseToBroadcast: AttackResponseData = {
                position: result.attackResult.position,
                status: result.attackResult.status,
                currentPlayer: result.nextPlayerId || room.currentPlayerTurn || "",
                shipField: result.attackResult.sunkShip ? [result.attackResult.sunkShip] : undefined,
                winPlayer: result.winnerId ?? undefined
            };

            const messagePayload = {
                type: "attack",
                data: JSON.stringify(attackResponseToBroadcast),
                id: 0
            };

            room.roomUsers.forEach(user => {
                const targetWs = Array.from(wss.clients as Set<WebSocket & {playerId: string}>)
                    .find(client => client.playerId === user.index);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify(messagePayload));
                }
            });
            console.log(`[${connectionId}] Broadcast attack result to room ${room.roomId}. Status: ${result.attackResult.status}`);

            if (result.winnerId) {
                console.log(`[${connectionId}] Game ${room.roomId} finished. Winner: ${result.winnerId}`);
                const finishMessage = {
                    type: "finish",
                    data: JSON.stringify({ winPlayer: result.winnerId, gameId: room.roomId }),
                    id: 0
                };
                room.roomUsers.forEach(user => {
                    const targetWs = Array.from(wss.clients as Set<WebSocket & {playerId: string}>)
                        .find(client => client.playerId === user.index);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify(finishMessage));
                    }
                });
            } else if (result.nextPlayerId) {
                const turnUpdateData: TurnDataToClient = {
                    currentPlayer: result.nextPlayerId,
                    gameId: room.roomId
                };
                const turnMessage = {
                    type: "turn",
                    data: JSON.stringify(turnUpdateData),
                    id: 0
                };
                room.roomUsers.forEach(user => {
                    const targetWs = Array.from(wss.clients as Set<WebSocket & {playerId: string}>)
                        .find(client => client.playerId === user.index);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify(turnMessage));
                    }
                });
                console.log(`[${connectionId}] Broadcast turn update to room ${room.roomId}, next player: ${result.nextPlayerId}`);
            }
        } else {
            console.error(`[${connectionId}] Room not found after attack for game ${clientData.gameId}`);
        }
    }

    public removePlayerFromRooms(playerId: string): void {
        console.log(`[GameHandler] Removing player ${playerId} from all rooms.`);
        const updatedRooms = roomServiceInstance.removePlayerFromRoomsAndNotify(playerId, 'GameHandler');
        console.log(`[GameHandler] Updated available rooms:`, updatedRooms);
    }

}

export const gameHandlerInstance = new GameHandler(gameServiceInstance);
