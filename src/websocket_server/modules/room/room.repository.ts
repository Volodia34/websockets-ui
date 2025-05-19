import { GameRoom, GameRoomUser } from './room.types.js';
import {ShipData} from "../game/game.types.js";

const gameRoomsDB: GameRoom[] = [];
let nextRoomIdCounter = 0;

export class RoomRepository {
    public getNextRoomId(): string {
        nextRoomIdCounter++;
        return `room_${nextRoomIdCounter}`;
    }

    public addRoom(room: GameRoom): GameRoom {
        gameRoomsDB.push(room);
        return room;
    }

    public findById(roomId: string): GameRoom | undefined {
        return gameRoomsDB.find(room => room.roomId === roomId);
    }

    public getAll(): GameRoom[] {
        return [...gameRoomsDB];
    }

    public getAvailableRooms(): Pick<GameRoom, 'roomId' | 'roomUsers'>[] {
        return gameRoomsDB
            .filter(room => room.roomUsers.length === 1)
            .map(room => ({
                roomId: room.roomId,
                roomUsers: room.roomUsers.map(user => ({ name: user.name, index: user.index }))
            }));
    }

    public removePlayerFromAllRooms(playerId: string): GameRoom[] {
        let changedRooms: GameRoom[] = [];
        gameRoomsDB.forEach(room => {
            const initialUserCount = room.roomUsers.length;
            room.roomUsers = room.roomUsers.filter(user => user.index !== playerId);
            if (room.roomUsers.length < initialUserCount) {
                changedRooms.push(room);
            }
        });
        const roomsToRemove = gameRoomsDB.filter(room => room.roomUsers.length === 0);
        roomsToRemove.forEach(roomToRemove => {
            const index = gameRoomsDB.indexOf(roomToRemove);
            if (index > -1) {
                gameRoomsDB.splice(index, 1);
            }
        });
        return changedRooms;
    }


    public addPlayerToRoom(roomId: string, user: GameRoomUser): GameRoom | null {
        const room = this.findById(roomId);
        if (room && room.roomUsers.length < 2 && !room.roomUsers.find(u => u.index === user.index)) {
            room.roomUsers.push(user);
            if (room.roomUsers.length === 2) {
                room.shipsReadyCount = 0;
                room.player1Ships = null;
                room.player2Ships = null;
                room.currentPlayerTurn = null;
            }
            return room;
        }
        return null;
    }

    public updatePlayerShips(roomId: string, playerId: string, ships: ShipData[]): GameRoom | undefined {
        const room = this.findById(roomId);
        if (room && room.roomUsers.length === 2) {
            const playerIndexInRoom = room.roomUsers.findIndex(user => user.index === playerId);
            if (playerIndexInRoom === 0) {
                if (!room.player1Ships) {
                    room.player1Ships = ships;
                    room.shipsReadyCount = (room.shipsReadyCount || 0) + 1;
                }
            } else if (playerIndexInRoom === 1) {
                if (!room.player2Ships) {
                    room.player2Ships = ships;
                    room.shipsReadyCount = (room.shipsReadyCount || 0) + 1;
                }
            }
            return room;
        }
        return undefined;
    }

    public setCurrentPlayerTurn(roomId: string, playerId: string | null): GameRoom | undefined {
        const room = this.findById(roomId);
        if (room) {
            room.currentPlayerTurn = playerId;
            return room;
        }
        return undefined;
    }

    public resetGameInRoom(roomId: string): GameRoom | undefined {
        const room = this.findById(roomId);
        if (room) {
            room.player1Ships = null;
            room.player2Ships = null;
            room.shipsReadyCount = 0;
            room.currentPlayerTurn = null;
        }
        return room;
    }

    public getPlayerShips(roomId: string, playerId: string): ShipData[] | undefined | null {
        const room = this.findById(roomId);
        if (!room) return undefined;
        const playerIndex = room.roomUsers.findIndex(u => u.index === playerId);
        if (playerIndex === 0) return room.player1Ships;
        if (playerIndex === 1) return room.player2Ships;
        return undefined;
    }

    public updatePlayerShipState(roomId: string, playerId: string, updatedShips: ShipData[]): GameRoom | undefined {
        const room = this.findById(roomId);
        if (!room) return undefined;
        const playerIndex = room.roomUsers.findIndex(u => u.index === playerId);
        if (playerIndex === 0) {
            room.player1Ships = updatedShips;
        } else if (playerIndex === 1) {
            room.player2Ships = updatedShips;
        } else {
            return undefined;
        }
        return room;
    }

}

export const roomRepositoryInstance = new RoomRepository();
