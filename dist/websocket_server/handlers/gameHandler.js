import { WebSocket } from 'ws';
import { findRoomById, updatePlayerShips, setCurrentPlayerTurn, } from '../db.js';
export function handleAddShips(ws, wss, clientData, messageId, connectionId) {
    const { gameId, ships, indexPlayer: playerIdFromClient } = clientData;
    const currentPlayerId = ws.playerId;
    if (!currentPlayerId || currentPlayerId !== playerIdFromClient) {
        console.error(`[${connectionId}] Unauthorized add_ships attempt or mismatched player ID. Auth: ${currentPlayerId}, Sent: ${playerIdFromClient}`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'Authentication error or invalid player ID for add_ships.' }),
            id: messageId
        }));
        return;
    }
    const room = findRoomById(gameId);
    if (!room) {
        console.warn(`[${connectionId}] Game room ${gameId} not found for add_ships by player ${currentPlayerId}.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: `Game room ${gameId} not found.` }),
            id: messageId
        }));
        return;
    }
    if (room.roomUsers.length !== 2) {
        console.warn(`[${connectionId}] Room ${gameId} does not have 2 players for add_ships. Current: ${room.roomUsers.length}`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'Game requires 2 players to add ships.' }),
            id: messageId
        }));
        return;
    }
    const playerInRoom = room.roomUsers.find(user => user.index === currentPlayerId);
    if (!playerInRoom) {
        console.error(`[${connectionId}] Player ${currentPlayerId} is not a participant in room ${gameId}.`);
        ws.send(JSON.stringify({
            type: 'error',
            data: JSON.stringify({ message: 'You are not a participant in this game.' }),
            id: messageId
        }));
        return;
    }
    const playerIndexInRoomArray = room.roomUsers.findIndex(user => user.index === currentPlayerId);
    if (playerIndexInRoomArray === 0 && room.player1Ships) {
        console.log(`[${connectionId}] Player ${currentPlayerId} (Player 1) already submitted ships for game ${gameId}.`);
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'You have already submitted your ships.' }), id: messageId }));
        return;
    }
    if (playerIndexInRoomArray === 1 && room.player2Ships) {
        console.log(`[${connectionId}] Player ${currentPlayerId} (Player 2) already submitted ships for game ${gameId}.`);
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'You have already submitted your ships.' }), id: messageId }));
        return;
    }
    const updatedRoom = updatePlayerShips(gameId, currentPlayerId, ships);
    if (!updatedRoom) {
        console.error(`[${connectionId}] Failed to update ships for player ${currentPlayerId} in game ${gameId}.`);
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'Failed to save ships.' }), id: messageId }));
        return;
    }
    console.log(`[${connectionId}] Player ${currentPlayerId} submitted ships for game ${gameId}. Ships ready count: ${updatedRoom.shipsReadyCount}`);
    if (updatedRoom.shipsReadyCount === 2) {
        console.log(`[${connectionId}] Both players in game ${gameId} have submitted ships. Starting game.`);
        const firstPlayerTurnId = updatedRoom.roomUsers[0].index;
        setCurrentPlayerTurn(gameId, firstPlayerTurnId);
        updatedRoom.currentPlayerTurn = firstPlayerTurnId;
        updatedRoom.roomUsers.forEach(userInRoom => {
            const playerShips = userInRoom.index === updatedRoom.roomUsers[0].index ? updatedRoom.player1Ships : updatedRoom.player2Ships;
            if (!playerShips) {
                console.error(`[${connectionId}] Ships not found for player ${userInRoom.index} in game ${gameId} when starting game.`);
                return;
            }
            const startGamePayload = {
                ships: playerShips,
                currentPlayerIndex: firstPlayerTurnId
            };
            const turnPayload = {
                currentPlayer: firstPlayerTurnId
            };
            let targetWs;
            wss.clients.forEach((clientWs) => {
                if (clientWs.playerId === userInRoom.index) {
                    targetWs = clientWs;
                }
            });
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                    type: "start_game",
                    data: JSON.stringify(startGamePayload),
                    id: 0
                }));
                console.log(`[${connectionId}] Sent 'start_game' to player ${userInRoom.name} (ID: ${userInRoom.index}) for game ${gameId}.`);
                targetWs.send(JSON.stringify({
                    type: "turn",
                    data: JSON.stringify(turnPayload),
                    id: 0
                }));
                console.log(`[${connectionId}] Sent 'turn' to player ${userInRoom.name} (ID: ${userInRoom.index}). Current turn: ${firstPlayerTurnId}`);
            }
            else {
                console.warn(`[${connectionId}] Could not find active WebSocket for player ${userInRoom.name} (ID: ${userInRoom.index}) to send start_game/turn messages.`);
            }
        });
    }
    else {
        console.log(`[${connectionId}] Waiting for other player in game ${gameId} to submit ships.`);
    }
}
