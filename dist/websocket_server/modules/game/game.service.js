import { roomRepositoryInstance } from '../room/room.repository.js';
import { playerServiceInstance } from '../player/player.service.js';
import { updateWinners } from '../../db.js';
export class GameService {
    roomRepository;
    playerService;
    activeGameBoards = new Map();
    constructor(roomRepository, playerService) {
        this.roomRepository = roomRepository;
        this.playerService = playerService;
    }
    addShips(clientData, connectionId) {
        const { gameId, ships, indexPlayer } = clientData;
        const room = this.roomRepository.findById(gameId);
        if (!room) {
            console.error(`[${connectionId}] Room ${gameId} not found for addShips.`);
            return {};
        }
        if (room.roomUsers.length !== 2) {
            console.error(`[${connectionId}] Room ${gameId} is not full for addShips.`);
            return { room };
        }
        const updatedRoom = this.roomRepository.updatePlayerShips(gameId, indexPlayer, ships);
        if (!updatedRoom) {
            console.error(`[${connectionId}] Failed to update ships for player ${indexPlayer} in room ${gameId}.`);
            return { room };
        }
        console.log(`[${connectionId}] Player ${indexPlayer} added ships to room ${gameId}. Ships ready: ${updatedRoom.shipsReadyCount}`);
        if (updatedRoom.shipsReadyCount === 2) {
            const firstPlayerIndex = Math.random() < 0.5 ? 0 : 1;
            const firstPlayerId = updatedRoom.roomUsers[firstPlayerIndex].index;
            this.roomRepository.setCurrentPlayerTurn(gameId, firstPlayerId);
            const boardSize = 10;
            const initialBoard = () => Array(boardSize).fill(null).map(() => Array(boardSize).fill(0));
            this.activeGameBoards.set(gameId, {
                board1: initialBoard(),
                board2: initialBoard()
            });
            console.log(`[${connectionId}] Active game boards initialized for game ${gameId}.`);
            const player1 = updatedRoom.roomUsers[0];
            const player2 = updatedRoom.roomUsers[1];
            const gameDataForPlayer1 = {
                ships: updatedRoom.player1Ships || [],
                currentPlayerIndex: firstPlayerId,
                gameId: room.roomId,
            };
            const gameDataForPlayer2 = {
                ships: updatedRoom.player2Ships || [],
                currentPlayerIndex: firstPlayerId,
                gameId: room.roomId,
            };
            console.log(`[${connectionId}] Game can start in room ${gameId}. First turn: ${firstPlayerId}`);
            return { room: updatedRoom, gameCanStart: true, startGameData: { player1: gameDataForPlayer1, player2: gameDataForPlayer2 } };
        }
        return { room: updatedRoom, gameCanStart: false };
    }
    attack(clientData, connectionId) {
        const { gameId, indexPlayer: attackerId, x, y } = clientData;
        const room = this.roomRepository.findById(gameId);
        if (!room) {
            console.error(`[${connectionId}] Attack error: Room ${gameId} not found.`);
            return { success: false, message: `Room ${gameId} not found.` };
        }
        if (room.currentPlayerTurn !== attackerId) {
            console.warn(`[${connectionId}] Attack error: Not player ${attackerId}'s turn in room ${gameId}. Current turn: ${room.currentPlayerTurn}`);
            return { success: false, message: 'Not your turn.' };
        }
        if (room.roomUsers.length < 2 || room.shipsReadyCount !== 2) {
            console.error(`[${connectionId}] Attack error: Game not started or not all players ready in room ${gameId}. Users: ${room.roomUsers.length}, ShipsReady: ${room.shipsReadyCount}`);
            return { success: false, message: 'Game not started or not all players ready.' };
        }
        const opponent = room.roomUsers.find(user => user.index !== attackerId);
        if (!opponent) {
            console.error(`[${connectionId}] Attack error: Opponent not found for attacker ${attackerId} in room ${gameId}.`);
            return { success: false, message: 'Opponent not found.' };
        }
        const opponentPlayerId = opponent.index;
        let opponentShips = this.roomRepository.getPlayerShips(gameId, opponentPlayerId);
        const gameBoards = this.activeGameBoards.get(gameId);
        if (!opponentShips) {
            console.error(`[${connectionId}] Attack error: Opponent's ships for player ${opponentPlayerId} in game ${gameId} not found in repository.`);
            return { success: false, message: "Opponent's ship data not found." };
        }
        if (!gameBoards) {
            console.error(`[${connectionId}] Attack error: Game boards for game ${gameId} not found in activeGameBoards. This should have been initialized at game start.`);
            return { success: false, message: "Game board state not found on server." };
        }
        let targetBoard;
        if (attackerId === room.roomUsers[0].index) {
            targetBoard = gameBoards.board2;
        }
        else {
            targetBoard = gameBoards.board1;
        }
        if (y < 0 || y >= targetBoard.length || x < 0 || x >= targetBoard[0].length) {
            console.warn(`[${connectionId}] Attack error: Coordinates (${x},${y}) out of bounds for room ${gameId}.`);
            return { success: false, message: 'Attack coordinates out of bounds.' };
        }
        if (targetBoard[y][x] === 1 || targetBoard[y][x] === 3 || targetBoard[y][x] === 4 || targetBoard[y][x] === 2) {
            console.warn(`[${connectionId}] Attack info: Cell (${x},${y}) already attacked in room ${gameId}. Status: ${targetBoard[y][x]}`);
            return { success: false, message: 'Cell already attacked.' };
        }
        let attackResultStatus = 'miss';
        let sunkShipData;
        let shipWasHit = false;
        const updatedOpponentShips = opponentShips.map(ship => {
            if (ship.isSunk)
                return ship;
            let currentShipBeingChecked = { ...ship, hits: ship.hits || 0 };
            for (let i = 0; i < currentShipBeingChecked.length; i++) {
                const partX = currentShipBeingChecked.direction ? currentShipBeingChecked.position.x : currentShipBeingChecked.position.x + i;
                const partY = currentShipBeingChecked.direction ? currentShipBeingChecked.position.y + i : currentShipBeingChecked.position.y;
                if (partX === x && partY === y) {
                    shipWasHit = true;
                    currentShipBeingChecked.hits = (currentShipBeingChecked.hits || 0) + 1;
                    if (currentShipBeingChecked.hits >= currentShipBeingChecked.length) {
                        currentShipBeingChecked.isSunk = true;
                        attackResultStatus = 'killed';
                        sunkShipData = { ...currentShipBeingChecked };
                        console.log(`[${connectionId}] Ship sunk in room ${gameId}! Type: ${sunkShipData.type}, Length: ${sunkShipData.length}`);
                    }
                    else {
                        attackResultStatus = 'shot';
                    }
                    return currentShipBeingChecked;
                }
            }
            return ship;
        });
        this.roomRepository.updatePlayerShipState(gameId, opponentPlayerId, updatedOpponentShips);
        if (attackResultStatus === 'miss') {
            targetBoard[y][x] = 1;
        }
        else {
            targetBoard[y][x] = 3;
            if (sunkShipData) {
                this.markCellsAroundSunkShip(targetBoard, sunkShipData);
                for (let i = 0; i < sunkShipData.length; i++) {
                    const partX = sunkShipData.direction ? sunkShipData.position.x : sunkShipData.position.x + i;
                    const partY = sunkShipData.direction ? sunkShipData.position.y + i : sunkShipData.position.y;
                    if (partX >= 0 && partY >= 0 && partY < targetBoard.length && partX < targetBoard[0].length) {
                        targetBoard[partY][partX] = 4;
                    }
                }
            }
        }
        const allOpponentShipsSunk = updatedOpponentShips.every(ship => ship.isSunk);
        let winner = null;
        if (allOpponentShipsSunk) {
            winner = attackerId;
            const winnerPlayer = this.playerService.findById(winner);
            if (winnerPlayer) {
                updateWinners(winnerPlayer.name);
                console.log(`[${connectionId}] Player ${winnerPlayer.name} (${winner}) won in room ${gameId}!`);
            }
            this.activeGameBoards.delete(gameId);
            console.log(`[${connectionId}] Active game boards deleted for finished game ${gameId}.`);
        }
        const nextPlayer = (attackResultStatus === 'miss' || winner) ? opponentPlayerId : attackerId;
        if (!winner) {
            this.roomRepository.setCurrentPlayerTurn(gameId, nextPlayer);
        }
        else {
            this.roomRepository.setCurrentPlayerTurn(gameId, opponentPlayerId);
        }
        const finalAttackResult = {
            status: attackResultStatus,
            position: { x, y },
            sunkShip: sunkShipData,
        };
        console.log(`[${connectionId}] Attack by ${attackerId} on (${x},${y}) in room ${gameId}. Result: ${attackResultStatus}. Next turn: ${winner ? 'Game Over' : nextPlayer}`);
        return {
            success: true,
            attackResult: finalAttackResult,
            nextPlayerId: winner ? null : nextPlayer,
            winnerId: winner,
            room: this.roomRepository.findById(gameId),
        };
    }
    markCellsAroundSunkShip(board, sunkShip) {
        const { position, length, direction } = sunkShip;
        const boardHeight = board.length;
        const boardWidth = board[0].length;
        for (let i = 0; i < length; i++) {
            const shipCellX = direction ? position.x : position.x + i;
            const shipCellY = direction ? position.y + i : position.y;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0)
                        continue;
                    const checkX = shipCellX + dx;
                    const checkY = shipCellY + dy;
                    if (checkX >= 0 && checkX < boardWidth && checkY >= 0 && checkY < boardHeight) {
                        if (board[checkY][checkX] === 0) {
                            board[checkY][checkX] = 2;
                        }
                    }
                }
            }
        }
    }
    cleanupGame(gameId, connectionId) {
        if (this.activeGameBoards.has(gameId)) {
            this.activeGameBoards.delete(gameId);
            console.log(`[${connectionId || 'Cleanup'}] Active game board for game ${gameId} removed.`);
        }
    }
}
export const gameServiceInstance = new GameService(roomRepositoryInstance, playerServiceInstance);
