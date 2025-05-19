import { WebSocket, WebSocketServer } from 'ws';
import {
    AddShipsClientData,
    StartGameResponseData,
    TurnResponseData,
    AttackClientData,
    AttackResponseData,
    AttackStatus,
    FinishResponseData,
    GameRoom,
    ShipData,
    Winner
} from '../types.js';
import {
    findRoomById,
    updatePlayerShips,
    setCurrentPlayerTurn,
    applyAttack,
    checkAllShipsSunk,
    getOpponentId,
    switchTurn,
    updateWinners,
    winnersDB, findPlayerById
} from '../db.js';
import { broadcastToAll } from '../utils.js';

export function handleAddShips(
    ws: WebSocket,
    wss: WebSocketServer,
    clientData: AddShipsClientData,
    messageId: number,
    connectionId: string
): void {
    const { gameId, ships, indexPlayer: playerIdFromClient } = clientData;
    const currentPlayerId = (ws as any).playerId as string | undefined;

    if (!currentPlayerId || currentPlayerId !== playerIdFromClient) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'Auth error or invalid player ID for add_ships.' }), id: messageId }));
        return;
    }
    const room = findRoomById(gameId);
    if (!room) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: `Game room ${gameId} not found.` }), id: messageId }));
        return;
    }
    if (room.roomUsers.length !== 2) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'Game requires 2 players to add ships.' }), id: messageId }));
        return;
    }
    const playerInRoom = room.roomUsers.find(user => user.index === currentPlayerId);
    if (!playerInRoom) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'You are not a participant in this game.' }), id: messageId }));
        return;
    }
    const playerIndexInRoomArray = room.roomUsers.findIndex(user => user.index === currentPlayerId);
    if ((playerIndexInRoomArray === 0 && room.player1Ships) || (playerIndexInRoomArray === 1 && room.player2Ships)) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({message: 'You have already submitted your ships.'}), id: messageId }));
        return;
    }

    const updatedRoom = updatePlayerShips(gameId, currentPlayerId, ships);
    if (!updatedRoom) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({message: 'Failed to save ships.'}), id: messageId }));
        return;
    }
    console.log(`[${connectionId}] Player ${currentPlayerId} submitted ships for game ${gameId}. Ships ready: ${updatedRoom.shipsReadyCount}`);

    if (updatedRoom.shipsReadyCount === 2) {
        console.log(`[${connectionId}] Both players in game ${gameId} ready. Starting game.`);
        const firstPlayerTurnId = updatedRoom.roomUsers[0].index;
        setCurrentPlayerTurn(gameId, firstPlayerTurnId);
        updatedRoom.currentPlayerTurn = firstPlayerTurnId;

        updatedRoom.roomUsers.forEach(userInRoom => {
            const playerShips = userInRoom.index === updatedRoom.roomUsers[0].index ? updatedRoom.player1Ships : updatedRoom.player2Ships;
            if (!playerShips) return;

            const startGamePayload: StartGameResponseData = { ships: playerShips, currentPlayerIndex: firstPlayerTurnId };
            const turnPayload: TurnResponseData = { currentPlayer: firstPlayerTurnId };
            let targetWs: WebSocket | undefined;
            wss.clients.forEach((clientWs: WebSocket) => { if ((clientWs as any).playerId === userInRoom.index) targetWs = clientWs; });

            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({ type: "start_game", data: JSON.stringify(startGamePayload), id: 0 }));
                targetWs.send(JSON.stringify({ type: "turn", data: JSON.stringify(turnPayload), id: 0 }));
            }
        });
    }
}

export function handleAttack(
    ws: WebSocket,
    wss: WebSocketServer,
    clientData: AttackClientData,
    messageId: number,
    connectionId: string
): void {
    const { gameId, x, y, indexPlayer: attackingPlayerIdFromClient } = clientData;
    const currentAttackingPlayerId = (ws as any).playerId as string | undefined;

    if (!currentAttackingPlayerId || currentAttackingPlayerId !== attackingPlayerIdFromClient) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'Auth error or invalid player ID for attack.' }), id: messageId }));
        return;
    }

    const room = findRoomById(gameId);
    if (!room || !room.isGameActive) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: `Game ${gameId} not found or not active.` }), id: messageId }));
        return;
    }

    if (room.currentPlayerTurn !== currentAttackingPlayerId) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: "It's not your turn." }), id: messageId }));
        return;
    }

    if (x < 0 || x > 9 || y < 0 || y > 9) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: "Invalid attack coordinates." }), id: messageId }));
        return;
    }

    const attackResult = applyAttack(gameId, currentAttackingPlayerId, x, y);

    if (!attackResult) {
        ws.send(JSON.stringify({ type: 'error', data: JSON.stringify({ message: 'Failed to process attack.' }), id: messageId }));
        return;
    }

    const opponentId = getOpponentId(room, currentAttackingPlayerId);
    if (!opponentId) return;

    const attackResponseToAttacker: AttackResponseData = {
        position: { x, y },
        currentPlayer: currentAttackingPlayerId,
        status: attackResult.status,
    };
    ws.send(JSON.stringify({
        type: 'attack',
        data: JSON.stringify(attackResponseToAttacker),
        id: messageId
    }));

    const attackResponseToOpponent: AttackResponseData = {
        position: { x, y },
        currentPlayer: currentAttackingPlayerId,
        status: attackResult.status,
    };

    let opponentWs: WebSocket | undefined;
    wss.clients.forEach(client => { if ((client as any).playerId === opponentId) opponentWs = client; });

    if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
        opponentWs.send(JSON.stringify({
            type: 'attack',
            data: JSON.stringify(attackResponseToOpponent),
            id: 0
        }));
    }

    console.log(`[${connectionId}] Player ${currentAttackingPlayerId} attacked (${x},${y}) in game ${gameId}. Status: ${attackResult.status}`);

    if (attackResult.allSunk) {
        const finishPayload: FinishResponseData = { winPlayer: currentAttackingPlayerId };
        const winnerPlayer = findPlayerById(currentAttackingPlayerId);
        if(winnerPlayer) updateWinners(winnerPlayer.name);

        room.isGameActive = false;

        room.roomUsers.forEach(user => {
            let targetWs: WebSocket | undefined;
            wss.clients.forEach(client => { if ((client as any).playerId === user.index) targetWs = client; });
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({ type: 'finish', data: JSON.stringify(finishPayload), id: 0 }));
            }
        });
        console.log(`[${connectionId}] Game ${gameId} finished. Winner: ${currentAttackingPlayerId}`);

        const winnersPayload: Winner[] = [...winnersDB];
        broadcastToAll(wss, { type: "update_winners", data: JSON.stringify(winnersPayload), id: 0 });
        console.log(`[Broadcast] Sent 'update_winners' after game finish. Data:`, winnersPayload);

    } else {
        if (attackResult.status === 'miss') {
            switchTurn(room);
        }

        const turnPayload: TurnResponseData = { currentPlayer: room.currentPlayerTurn! };
        room.roomUsers.forEach(user => {
            let targetWs: WebSocket | undefined;
            wss.clients.forEach(client => { if ((client as any).playerId === user.index) targetWs = client; });
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({ type: 'turn', data: JSON.stringify(turnPayload), id: 0 }));
            }
        });
        console.log(`[${connectionId}] Turn updated for game ${gameId}. Current turn: ${room.currentPlayerTurn}`);
    }
}

export function handleRandomAttack(
    ws: WebSocket,
    wss: WebSocketServer,
    clientData: { gameId: string; indexPlayer: string },
    messageId: number,
    connectionId: string
): void {

}

