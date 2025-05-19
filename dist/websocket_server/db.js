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
export function updatePlayerShips(roomId, playerId, ships) {
    const room = findRoomById(roomId);
    if (room && room.roomUsers.length === 2) {
        const playerIndexInRoom = room.roomUsers.findIndex(user => user.index === playerId);
        if (playerIndexInRoom === 0) {
            if (!room.player1Ships) {
                room.player1Ships = ships;
                room.shipsReadyCount = (room.shipsReadyCount || 0) + 1;
            }
        }
        else if (playerIndexInRoom === 1) {
            if (!room.player2Ships) {
                room.player2Ships = ships;
                room.shipsReadyCount = (room.shipsReadyCount || 0) + 1;
            }
        }
        return room;
    }
    return undefined;
}
export function setCurrentPlayerTurn(roomId, playerId) {
    const room = findRoomById(roomId);
    if (room) {
        room.currentPlayerTurn = playerId;
    }
}
