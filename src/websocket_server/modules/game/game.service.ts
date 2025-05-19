import { RoomRepository, roomRepositoryInstance } from '../room/room.repository.js';
import { PlayerService, playerServiceInstance } from '../player/player.service.js';
import { GameRoom } from '../room/room.types.js';
import { AddShipsClientData, AttackClientData, AttackResponseData, PlayerGameState, ShipData, StartGameDataToClient } from './game.types.js';

export interface GameUpdateNofify {
    type: 'attack_result' | 'game_start' | 'turn_update' | 'game_finish';
    payload: any;
    recipients: string[];
}

export class GameService {
    constructor(
        private roomRepository: RoomRepository,
        private playerService: PlayerService
    ) {}

    public addShips(
        clientData: AddShipsClientData,
        connectionId: string
    ): { room?: GameRoom, gameCanStart?: boolean, startGameData?: { player1: StartGameDataToClient, player2: StartGameDataToClient } } {
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

    // public attack(...) {}
    // public singlePlay(...) {}
}

export const gameServiceInstance = new GameService(roomRepositoryInstance, playerServiceInstance);
