export const playersDB = [];
export const winnersDB = [];
export const gameRoomsDB = [];
let nextPlayerIdCounter = 0;
export function getNextUserIndex() {
    nextPlayerIdCounter++;
    return `player_${nextPlayerIdCounter}`;
}
export function findPlayerByName(name) {
    return playersDB.find(player => player.name === name);
}
export function addPlayer(player) {
    playersDB.push(player);
}
export function updateWinners(winnerName) {
    const winner = winnersDB.find(w => w.name === winnerName);
    if (winner) {
        winner.wins++;
    }
    else {
        winnersDB.push({ name: winnerName, wins: 1 });
    }
}
