import { Player } from './player.types.js';

const playersDB: Player[] = [];
let nextPlayerIdCounter = 0;

export class PlayerRepository {
    public getNextUserIndex(): string {
        nextPlayerIdCounter++;
        return `player_${nextPlayerIdCounter}`;
    }

    public findByName(name: string): Player | undefined {
        return playersDB.find(player => player.name === name);
    }

    public findById(id: string): Player | undefined {
        return playersDB.find(player => player.id === id);
    }

    public addPlayer(player: Player): void {
        playersDB.push(player);
    }

    public getAllPlayers(): Player[] {
        return [...playersDB];
    }
}

export const playerRepositoryInstance = new PlayerRepository();
