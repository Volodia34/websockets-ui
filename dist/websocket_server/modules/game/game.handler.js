import { WebSocket } from 'ws';
import { gameServiceInstance } from './game.service.js';
import { roomServiceInstance } from "../room/room.service.js";
export class GameHandler {
    gameService;
    constructor(gameService) {
        this.gameService = gameService;
    }
    handleAddShips(ws, wss, clientData, messageId, connectionId) {
        console.log(`[${connectionId}] Handling add_ships for game ${clientData.gameId} by player ${clientData.indexPlayer}`);
        const result = this.gameService.addShips(clientData, connectionId);
        if (result.room && result.gameCanStart && result.startGameData) {
            const room = result.room;
            const player1 = room.roomUsers[0];
            const player2 = room.roomUsers[1];
            const wsPlayer1 = Array.from(wss.clients).find(client => client.playerId === player1.index);
            const wsPlayer2 = Array.from(wss.clients).find(client => client.playerId === player2.index);
            if (wsPlayer1 && result.startGameData.player1) {
                wsPlayer1.send(JSON.stringify({
                    type: "start_game",
                    data: JSON.stringify(result.startGameData.player1),
                    id: 0
                }));
                console.log(`[${connectionId}] Sent start_game to ${player1.name} (${player1.index})`);
            }
            if (wsPlayer2 && result.startGameData.player2) {
                wsPlayer2.send(JSON.stringify({
                    type: "start_game",
                    data: JSON.stringify(result.startGameData.player2),
                    id: 0
                }));
                console.log(`[${connectionId}] Sent start_game to ${player2.name} (${player2.index})`);
            }
            if (room.currentPlayerTurn) {
                const turnUpdatePayload = {
                    currentPlayer: room.currentPlayerTurn,
                    gameId: room.roomId
                };
                const turnUpdateMessage = {
                    type: "turn",
                    data: JSON.stringify(turnUpdatePayload),
                    id: 0
                };
                if (wsPlayer1) {
                    wsPlayer1.send(JSON.stringify(turnUpdateMessage));
                }
                if (wsPlayer2) {
                    wsPlayer2.send(JSON.stringify(turnUpdateMessage));
                }
                console.log(`[${connectionId}] Sent initial turn update to room ${room.roomId}, current player: ${room.currentPlayerTurn}`);
            }
            else {
                console.error(`[${connectionId}] currentPlayerTurn not set in room ${room.roomId} after starting game.`);
            }
        }
        else if (result.room) {
            console.log(`[${connectionId}] Ships added by ${clientData.indexPlayer} to game ${clientData.gameId}, waiting for other player. Ships ready: ${result.room.shipsReadyCount}`);
            ws.send(JSON.stringify({
                type: "ships_accepted",
                data: JSON.stringify({
                    message: "Your ships have been placed. Waiting for the opponent.",
                    gameId: clientData.gameId,
                    playerId: clientData.indexPlayer
                }),
                id: messageId
            }));
        }
        else {
            console.error(`[${connectionId}] Failed to process add_ships for game ${clientData.gameId}. Room or data missing.`);
            ws.send(JSON.stringify({
                type: "error",
                data: JSON.stringify({ message: "Failed to add ships. Room not found or not ready." }),
                id: messageId
            }));
        }
    }
    handleAttack(ws, wss, clientData, messageId, connectionId) {
        console.log(`[${connectionId}] Handling attack in game ${clientData.gameId} by player ${clientData.indexPlayer} on [${clientData.x}, ${clientData.y}]`);
        const result = this.gameService.attack(clientData, connectionId);
        if (!result.success || !result.attackResult) {
            console.error(`[${connectionId}] Attack failed for player ${clientData.indexPlayer} in game ${clientData.gameId}: ${result.message}`);
            ws.send(JSON.stringify({
                type: 'error',
                data: JSON.stringify({ message: result.message || "Attack failed." }),
                id: messageId
            }));
            return;
        }
        const room = result.room;
        if (room) {
            const attackResponsePayload = {
                position: result.attackResult.position,
                status: result.attackResult.status,
                currentPlayer: clientData.indexPlayer,
                ...(result.attackResult.sunkShip && { shipField: [result.attackResult.sunkShip] }),
            };
            const attackResponseMessage = {
                type: "attack",
                data: JSON.stringify(attackResponsePayload),
                id: 0
            };
            room.roomUsers.forEach(user => {
                const targetWs = Array.from(wss.clients)
                    .find(client => client.playerId === user.index);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify(attackResponseMessage));
                }
            });
            console.log(`[${connectionId}] Broadcast attack result to room ${room.roomId}. Status: ${result.attackResult.status}, Attacker: ${clientData.indexPlayer}`);
            if (result.winnerId) {
                console.log(`[${connectionId}] Game ${room.roomId} finished. Winner: ${result.winnerId}`);
                const finishMessagePayload = { winPlayer: result.winnerId, gameId: room.roomId };
                const finishMessage = {
                    type: "finish",
                    data: JSON.stringify(finishMessagePayload),
                    id: 0
                };
                room.roomUsers.forEach(user => {
                    const targetWs = Array.from(wss.clients)
                        .find(client => client.playerId === user.index);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify(finishMessage));
                    }
                });
            }
            else if (result.nextPlayerId && room.currentPlayerTurn) {
                const turnUpdatePayload = {
                    currentPlayer: room.currentPlayerTurn,
                    gameId: room.roomId
                };
                const turnMessage = {
                    type: "turn",
                    data: JSON.stringify(turnUpdatePayload),
                    id: 0
                };
                room.roomUsers.forEach(user => {
                    const targetWs = Array.from(wss.clients)
                        .find(client => client.playerId === user.index);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify(turnMessage));
                    }
                });
                console.log(`[${connectionId}] Broadcast turn update to room ${room.roomId}, next player: ${room.currentPlayerTurn}`);
            }
            else if (!result.winnerId && !result.nextPlayerId) {
                console.warn(`[${connectionId}] Attack processed in room ${room.roomId}, but no winner and no next player ID determined. Current turn: ${room.currentPlayerTurn}`);
            }
        }
        else {
            console.error(`[${connectionId}] Room not found after attack processing for game ${clientData.gameId}. This indicates a state issue.`);
            ws.send(JSON.stringify({
                type: 'error',
                data: JSON.stringify({ message: "Internal server error: Room state lost after attack." }),
                id: messageId
            }));
        }
    }
    removePlayerFromRooms(playerId) {
        console.log(`[GameHandler] Attempting to remove player ${playerId} from rooms and cleanup games.`);
        const playerRooms = roomServiceInstance.getRoomsByPlayerId(playerId);
        playerRooms.forEach(room => {
            if (room.isGameActive) {
                gameServiceInstance.cleanupGame(room.roomId, `PlayerDisconnect-${playerId}`);
            }
        });
        const updatedRooms = roomServiceInstance.removePlayerFromRoomsAndNotify(playerId, 'GameHandler');
        console.log(`[GameHandler] Player ${playerId} removed. Updated available rooms count:`, updatedRooms.length);
    }
    handleRandomAttack(ws, wss, clientData, messageId, connectionId) {
        console.log(`[${connectionId}] Handling randomAttack in game ${clientData.gameId} by player ${clientData.indexPlayer}`);
        const room = roomServiceInstance.findRoomById(clientData.gameId);
        if (!room || room.currentPlayerTurn !== clientData.indexPlayer) {
            ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: "Cannot perform random attack." }), id: messageId }));
            return;
        }
        const gameBoards = gameServiceInstance.activeGameBoards.get(clientData.gameId);
        if (!gameBoards) {
            ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: "Game board not found for random attack." }), id: messageId }));
            return;
        }
        let targetBoard;
        if (clientData.indexPlayer === room.roomUsers[0].index) {
            targetBoard = gameBoards.board2;
        }
        else {
            targetBoard = gameBoards.board1;
        }
        const availableCells = [];
        for (let r = 0; r < targetBoard.length; r++) {
            for (let c = 0; c < targetBoard[r].length; c++) {
                if (targetBoard[r][c] === 0) {
                    availableCells.push({ x: c, y: r });
                }
            }
        }
        if (availableCells.length === 0) {
            ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: "No available cells for random attack." }), id: messageId }));
            return;
        }
        const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
        const attackData = {
            gameId: clientData.gameId,
            indexPlayer: clientData.indexPlayer,
            x: randomCell.x,
            y: randomCell.y,
        };
        this.handleAttack(ws, wss, attackData, messageId, connectionId);
        console.log(`[${connectionId}] Random attack by ${clientData.indexPlayer} on (${randomCell.x},${randomCell.y}) in game ${clientData.gameId}`);
    }
}
export const gameHandlerInstance = new GameHandler(gameServiceInstance);
