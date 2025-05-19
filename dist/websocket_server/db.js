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
export function findPlayerById(id) {
    return playersDB.find(player => player.id === id);
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
let nextRoomIdCounter = 0;
export function getNextRoomId() {
    nextRoomIdCounter++;
    return `room_${nextRoomIdCounter}`;
}
export function addRoom(room) {
    gameRoomsDB.push(room);
}
export function findRoomById(roomId) {
    return gameRoomsDB.find(room => room.roomId === roomId);
}
export function removePlayerFromRooms(playerId) {
    gameRoomsDB.forEach(room => {
        room.roomUsers = room.roomUsers.filter(user => user.index !== playerId);
    });
}
