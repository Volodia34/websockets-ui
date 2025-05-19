import { playerRepositoryInstance } from './player.repository.js';
export class PlayerService {
    playerRepository;
    constructor(playerRepository) {
        this.playerRepository = playerRepository;
    }
    findByName(name) {
        return this.playerRepository.findByName(name);
    }
    findById(id) {
        return this.playerRepository.findById(id);
    }
    createPlayer(name, password) {
        const newPlayerId = this.playerRepository.getNextUserIndex();
        const newPlayer = {
            id: newPlayerId,
            name,
            password,
        };
        this.playerRepository.addPlayer(newPlayer);
        return newPlayer;
    }
}
export const playerServiceInstance = new PlayerService(playerRepositoryInstance);
