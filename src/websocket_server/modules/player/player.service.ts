import { PlayerRepository, playerRepositoryInstance } from './player.repository.js'
import { Player } from './player.types.js';

export class PlayerService {
    constructor(private playerRepository: PlayerRepository) {}

    public findByName(name: string): Player | undefined {
        return this.playerRepository.findByName(name);
    }

    public findById(id: string): Player | undefined {
        return this.playerRepository.findById(id);
    }

    public createPlayer(name: string, password: string): Player {
        const newPlayerId = this.playerRepository.getNextUserIndex();
        const newPlayer: Player = {
            id: newPlayerId,
            name,
            password,
        };
        this.playerRepository.addPlayer(newPlayer);
        return newPlayer;
    }
}

export const playerServiceInstance = new PlayerService(playerRepositoryInstance);
