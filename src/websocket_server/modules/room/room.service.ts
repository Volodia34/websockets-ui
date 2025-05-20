import { WebSocket } from 'ws';
import { RoomRepository, roomRepositoryInstance } from './room.repository.js';
import { GameRoom, GameRoomUser, CreateGameResponseData } from './room.types.js';
import { PlayerService, playerServiceInstance } from '../player/player.service.js';
import { Player } from '../player/player.types.js';

export interface RoomOperationResult<T = GameRoom | null> {
    success: boolean;
    message?: string;
    data?: T;
    updatedAvailableRooms?: Pick<GameRoom, 'roomId' | 'roomUsers'>[];
    gameCreationData?: { gameId: string, usersToNotify: GameRoomUser[] };
}

export class RoomService {
    constructor(
        private roomRepository: RoomRepository,
        private playerService: PlayerService
    ) {}

    public createRoom(requestingPlayerId: string, connectionId: string): RoomOperationResult {
        const player = this.playerService.findById(requestingPlayerId);

        if (!player) {
            console.error(`[${connectionId}] CRITICAL: Player with ID ${requestingPlayerId} not found for create_room.`);
            return { success: false, message: 'Authentication error: Player not found.' };
        }

        const alreadyInRoom = this.roomRepository.getAll().find(room =>
            room.roomUsers.some(user => user.index === requestingPlayerId)
        );

        if (alreadyInRoom) {
            console.log(`[${connectionId}] Player ${player.name} (ID: ${requestingPlayerId}) is already in room ${alreadyInRoom.roomId}. Cannot create new room.`);
            return {
                success: false,
                message: 'You are already in a room. Cannot create a new one.',
                updatedAvailableRooms: this.roomRepository.getAvailableRooms()
            };
        }

        const newRoomId = this.roomRepository.getNextRoomId();
        const creator: GameRoomUser = { name: player.name, index: player.id };
        const newRoom: GameRoom = {
            roomId: newRoomId,
            roomUsers: [creator],
            shipsReadyCount: 0,
            player1Ships: null,
            player2Ships: null,
            currentPlayerTurn: null,
        };

        this.roomRepository.addRoom(newRoom);
        console.log(`[${connectionId}] Player ${player.name} (ID: ${requestingPlayerId}) created room ${newRoomId}.`);

        return {
            success: true,
            data: newRoom,
            updatedAvailableRooms: this.roomRepository.getAvailableRooms()
        };
    }

    public addUserToRoom(joiningPlayerId: string, targetRoomId: string, connectionId: string): RoomOperationResult {
        const joiningPlayer = this.playerService.findById(joiningPlayerId);
        if (!joiningPlayer) {
            console.error(`[${connectionId}] Joining player with ID ${joiningPlayerId} not found.`);
            return { success: false, message: 'Authentication error: Your player ID was not found.' };
        }

        const foundRoom = this.roomRepository.findById(targetRoomId);

        if (!foundRoom) {
            console.warn(`[${connectionId}] Room ${targetRoomId} not found for player ${joiningPlayer.name} (ID: ${joiningPlayerId}).`);
            return { success: false, message: `Room with ID ${targetRoomId} not found.` };
        }

        if (foundRoom.roomUsers.some(user => user.index === joiningPlayerId)) {
            console.log(`[${connectionId}] Player ${joiningPlayer.name} (ID: ${joiningPlayerId}) is already in room ${targetRoomId}.`);
            return { success: false, message: 'You are already in this room.' };
        }

        if (foundRoom.roomUsers.length >= 2) {
            console.log(`[${connectionId}] Room ${targetRoomId} is already full. Player ${joiningPlayer.name} (ID: ${joiningPlayerId}) cannot join.`);
            return {
                success: false,
                message: 'The room is already full.',
                updatedAvailableRooms: this.roomRepository.getAvailableRooms()
            };
        }

        const updatedRoom = this.roomRepository.addPlayerToRoom(targetRoomId, { name: joiningPlayer.name, index: joiningPlayer.id });

        if (!updatedRoom) {
            console.error(`[${connectionId}] Failed to add player ${joiningPlayer.name} to room ${targetRoomId} for an unknown reason.`);
            return { success: false, message: 'Failed to join room.' };
        }

        console.log(`[${connectionId}] Player ${joiningPlayer.name} (ID: ${joiningPlayerId}) successfully joined room ${updatedRoom.roomId}.`);
        console.log(`[${connectionId}] Room ${updatedRoom.roomId} users:`, updatedRoom.roomUsers.map(u => u.name));

        const result: RoomOperationResult = {
            success: true,
            data: updatedRoom,
            updatedAvailableRooms: this.roomRepository.getAvailableRooms()
        };

        if (updatedRoom.roomUsers.length === 2) {
            console.log(`[${connectionId}] Room ${updatedRoom.roomId} is now full. Preparing to start game.`);
            result.gameCreationData = {
                gameId: updatedRoom.roomId,
                usersToNotify: updatedRoom.roomUsers
            };
        }
        return result;
    }

    public removePlayerFromRoomsAndNotify(playerId: string, connectionId: string): Pick<GameRoom, 'roomId' | 'roomUsers'>[] {
        console.log(`[${connectionId}] Removing player ${playerId} from all rooms.`);
        this.roomRepository.removePlayerFromAllRooms(playerId);
        return this.roomRepository.getAvailableRooms();
    }

    public getAvailableRooms(): Pick<GameRoom, 'roomId' | 'roomUsers'>[] {
        return this.roomRepository.getAvailableRooms();
    }

    public getRoomsByPlayerId(playerId: string): GameRoom[] {
        return this.roomRepository.getAll().filter(room =>
            room.roomUsers.some(user => user.index === playerId)
        );
    }

    public findRoomById(roomId: string): GameRoom | undefined {
        return this.roomRepository.findById(roomId);
    }
}

export const roomServiceInstance = new RoomService(roomRepositoryInstance, playerServiceInstance);
