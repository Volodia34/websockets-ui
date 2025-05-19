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
