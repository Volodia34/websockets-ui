import { RoomRepository, roomRepositoryInstance } from '../room/room.repository.js';
import { PlayerService, playerServiceInstance } from '../player/player.service.js';
import { GameRoom } from '../room/room.types.js';
import {
    AddShipsClientData,
    AttackClientData,
    AttackResult,
    AttackServiceResult,
    CellStatus,
    GameBoard,
    ShipData,
    StartGameDataToClient,
} from './game.types.js';
import { updateWinners } from '../../db.js';

export class GameService {
    private activeGameBoards: Map<string, { board1: GameBoard; board2: GameBoard }> = new Map();

    constructor(
        private roomRepository: RoomRepository,
        private playerService: PlayerService
    ) {}

    public addShips(
        clientData: AddShipsClientData,
        connectionId: string
    ): { room?: GameRoom; gameCanStart?: boolean; startGameData?: { player1: StartGameDataToClient; player2: StartGameDataToClient } } {
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

            const player1Id = updatedRoom.roomUsers[0].index;
            const player2Id = updatedRoom.roomUsers[1].index;

            const gameDataForPlayer1: StartGameDataToClient = {
                ships: updatedRoom.player2Ships || [],
                currentPlayerIndex: firstPlayerId,
                gameId: room.roomId,
            };
            const gameDataForPlayer2: StartGameDataToClient = {
                ships: updatedRoom.player1Ships || [],
                currentPlayerIndex: firstPlayerId,
                gameId: room.roomId,
            };

            console.log(`[${connectionId}] Game can start in room ${gameId}. First turn: ${firstPlayerId}`);
            return { room: updatedRoom, gameCanStart: true, startGameData: { player1: gameDataForPlayer1, player2: gameDataForPlayer2 } };
        }

        return { room: updatedRoom, gameCanStart: false };
    }

    public attack(clientData: AttackClientData, connectionId: string): AttackServiceResult {
        const { gameId, indexPlayer: attackerId, x, y } = clientData;
        const room = this.roomRepository.findById(gameId);

        if (!room) {
            return { success: false, message: `Room ${gameId} not found.` };
        }
        if (room.currentPlayerTurn !== attackerId) {
            return { success: false, message: 'Not your turn.' };
        }
        if (room.roomUsers.length < 2 || room.shipsReadyCount !== 2) {
            return { success: false, message: 'Game not started or not all players ready.' };
        }

        const opponent = room.roomUsers.find(user => user.index !== attackerId);
        if (!opponent) {
            return { success: false, message: 'Opponent not found.' };
        }

        const opponentPlayerId = opponent.index;
        let opponentShips = this.roomRepository.getPlayerShips(gameId, opponentPlayerId);
        const gameBoards = this.activeGameBoards.get(gameId);

        if (!opponentShips || !gameBoards) {
            return { success: false, message: "Opponent's ships or game board not found." };
        }

        const targetBoard = attackerId === room.roomUsers[0].index ? gameBoards.board2 : gameBoards.board1;

        if (y < 0 || y >= targetBoard.length || x < 0 || x >= targetBoard[0].length) {
            return { success: false, message: 'Attack coordinates out of bounds.' };
        }
        if (targetBoard[y][x] === 1 || targetBoard[y][x] === 3 || targetBoard[y][x] === 4) {
            return { success: false, message: 'Cell already attacked.' };
        }

        let attackResultStatus: 'miss' | 'shot' | 'killed' = 'miss';
        let sunkShipData: ShipData | undefined;

        opponentShips = opponentShips.map(ship => {
            if (ship.isSunk) return ship;
            for (let i = 0; i < ship.length; i++) {
                const shipX = ship.direction ? ship.position.x : ship.position.x + i;
                const shipY = ship.direction ? ship.position.y + i : ship.position.y;
                if (shipX === x && shipY === y) {
                    const newHits = (ship.hits || 0) + 1;
                    const isSunk = newHits >= ship.length;
                    if (isSunk) {
                        attackResultStatus = 'killed';
                        sunkShipData = { ...ship, hits: newHits, isSunk: true };
                    } else {
                        attackResultStatus = 'shot';
                    }
                    return { ...ship, hits: newHits, isSunk };
                }
            }
            return ship;
        });

        if (attackResultStatus === 'miss') {
            targetBoard[y][x] = 1 as CellStatus;
        } else {
            targetBoard[y][x] = 3 as CellStatus;
            if (sunkShipData) {
                this.markCellsAroundSunkShip(targetBoard, sunkShipData);
            }
            this.roomRepository.updatePlayerShipState(gameId, opponentPlayerId, opponentShips);
        }

        const allOpponentShipsSunk = opponentShips.every(ship => ship.isSunk);
        let winner: string | null = null;
        if (allOpponentShipsSunk) {
            winner = attackerId;
            const winnerPlayer = this.playerService.findById(winner);
            if (winnerPlayer) updateWinners(winnerPlayer.name);
            this.roomRepository.resetGameInRoom(gameId);
            this.activeGameBoards.delete(gameId);
        }

        const nextPlayer = attackResultStatus === 'miss' && !winner ? opponentPlayerId : attackerId;
        if (!winner) {
            this.roomRepository.setCurrentPlayerTurn(gameId, nextPlayer);
        }

        const finalAttackResult: AttackResult = {
            status: attackResultStatus,
            position: { x, y },
            sunkShip: sunkShipData,
        };

        return {
            success: true,
            attackResult: finalAttackResult,
            nextPlayerId: winner ? null : nextPlayer,
            winnerId: winner,
            room: this.roomRepository.findById(gameId),
        };
    }

    private markCellsAroundSunkShip(board: GameBoard, sunkShip: ShipData): void {
        const { position, length, direction } = sunkShip;

        for (let i = -1; i <= length; i++) {
            for (let j = -1; j <= 1; j++) {
                const x = direction ? position.x + j : position.x + i;
                const y = direction ? position.y + i : position.y + j;

                if (x >= 0 && y >= 0 && y < board.length && x < board[0].length && board[y][x] === 0) {
                    board[y][x] = 2 as CellStatus;
                }
            }
        }
    }
}

export const gameServiceInstance = new GameService(roomRepositoryInstance, playerServiceInstance);
