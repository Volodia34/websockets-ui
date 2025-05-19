const playersDB = [];
let nextPlayerIdCounter = 0;
export class PlayerRepository {
    getNextUserIndex() {
        nextPlayerIdCounter++;
        return `player_${nextPlayerIdCounter}`;
    }
    findByName(name) {
        return playersDB.find(player => player.name === name);
    }
    findById(id) {
        return playersDB.find(player => player.id === id);
    }
    addPlayer(player) {
        playersDB.push(player);
    }
    getAllPlayers() {
        return [...playersDB];
    }
}
export const playerRepositoryInstance = new PlayerRepository();
