import { Player, Winner, GameRoom } from './types.js';

export const playersDB: Player[] = [];
export const winnersDB: Winner[] = [];
export const gameRoomsDB: GameRoom[] = [];

let nextPlayerIdCounter = 0;

export function getNextUserIndex(): string {
    nextPlayerIdCounter++;
    return `player_${nextPlayerIdCounter}`;
}

export function findPlayerByName(name: string): Player | undefined {
    return playersDB.find(player => player.name === name);
}

export function findPlayerById(id: string): Player | undefined {
    return playersDB.find(player => player.id === id);
}


export function addPlayer(player: Player): void {
    playersDB.push(player);
}

export function updateWinners(winnerName: string): void {
    const winner = winnersDB.find(w => w.name === winnerName);
    if (winner) {
        winner.wins++;
    } else {
        winnersDB.push({ name: winnerName, wins: 1 });
    }
}


let nextRoomIdCounter = 0;
export function getNextRoomId(): string {
    nextRoomIdCounter++;
    return `room_${nextRoomIdCounter}`;
}

export function addRoom(room: GameRoom): void {
    gameRoomsDB.push(room);
}

export function findRoomById(roomId: string): GameRoom | undefined {
    return gameRoomsDB.find(room => room.roomId === roomId);
}

export function removePlayerFromRooms(playerId: string): void {
    gameRoomsDB.forEach(room => {
        room.roomUsers = room.roomUsers.filter(user => user.index !== playerId);
    });

}
