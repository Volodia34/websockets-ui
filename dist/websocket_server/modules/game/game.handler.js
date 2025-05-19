import { gameServiceInstance } from './game.service.js';
import { broadcastToAll } from '../../core/wsUtils.js';
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
        }
        else if (result.room) {
            console.log(`[${connectionId}] Ships added by ${clientData.indexPlayer}, waiting for other player. Ships ready: ${result.room.shipsReadyCount}`);
            ws.send(JSON.stringify({
                type: "ships_accepted", // Приклад типу
                data: JSON.stringify({ gameId: clientData.gameId, playerId: clientData.indexPlayer }),
                id: messageId
            }));
        }
        else {
            console.error(`[${connectionId}] Failed to process add_ships for game ${clientData.gameId}`);
            ws.send(JSON.stringify({
                type: "error",
                data: JSON.stringify({ message: "Failed to add ships. Room not found or not ready." }),
                id: messageId
            }));
        }
    }
}
export const gameHandlerInstance = new GameHandler(gameServiceInstance);
