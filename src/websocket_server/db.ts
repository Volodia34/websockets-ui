import { Winner, GameRoom, ShipData, CellState, ShipHealth } from './types.js';
import {Player} from "./modules/player/player.types.js";

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

function createInitialBoard(): CellState[][] {
    return Array(10).fill(null).map(() => Array(10).fill(0));
}

function populateBoardWithShips(board: CellState[][], ships: ShipData[], shipStates: ShipHealth[]): void {
    ships.forEach((ship, index) => {
        const shipCells: {x:number, y:number}[] = [];
        for (let i = 0; i < ship.length; i++) {
            const x = ship.direction ? ship.position.x : ship.position.x + i;
            const y = ship.direction ? ship.position.y + i : ship.position.y;
            if (x < 10 && y < 10) {
                board[y][x] = 1;
                shipCells.push({x, y});
            }
        }
        shipStates.push({
            ...ship,
            id: index,
            hits: 0,
            isSunk: false,
            cells: shipCells
        });
    });
}

export function initializeGameData(room: GameRoom): void {
    room.player1Board = createInitialBoard();
    room.player2Board = createInitialBoard();
    room.player1ShipStates = [];
    room.player2ShipStates = [];

    if (room.player1Ships && room.player1Board && room.player1ShipStates) {
        populateBoardWithShips(room.player1Board, room.player1Ships, room.player1ShipStates);
    }
    if (room.player2Ships && room.player2Board && room.player2ShipStates) {
        populateBoardWithShips(room.player2Board, room.player2Ships, room.player2ShipStates);
    }
    room.isGameActive = true;
}


export function updatePlayerShips(roomId: string, playerId: string, ships: ShipData[]): GameRoom | undefined {
    const room = findRoomById(roomId);
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
        if (room.shipsReadyCount === 2) {
            initializeGameData(room);
        }
        return room;
    }
    return undefined;
}

export function setCurrentPlayerTurn(roomId: string, playerId: string): void {
    const room = findRoomById(roomId);
    if (room) {
        room.currentPlayerTurn = playerId;
    }
}

export function getOpponentId(room: GameRoom, currentPlayerId: string): string | undefined {
    return room.roomUsers.find(user => user.index !== currentPlayerId)?.index;
}

export function switchTurn(room: GameRoom): void {
    if (room.currentPlayerTurn && room.roomUsers.length === 2) {
        room.currentPlayerTurn = room.roomUsers.find(user => user.index !== room.currentPlayerTurn!)!.index;
    }
}

function markCellsAroundSunkShip(board: CellState[][], ship: ShipHealth) {
    ship.cells.forEach(cell => {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const ny = cell.y + dy;
                const nx = cell.x + dx;
                if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && board[ny][nx] === 0) {
                    board[ny][nx] = 5;
                }
            }
        }
    });
    ship.cells.forEach(cell => {
        board[cell.y][cell.x] = 4;
    });
}


export function applyAttack(
    roomId: string,
    attackingPlayerId: string,
    x: number,
    y: number
): { status: "miss" | "shot" | "killed", hitShipId?: number, allSunk: boolean, sunkShipCells?: {x:number, y:number}[] } | null {
    const room = findRoomById(roomId);
    if (!room || !room.isGameActive) return null;

    const opponentId = getOpponentId(room, attackingPlayerId);
    if (!opponentId) return null;

    const isAttackingPlayer1 = room.roomUsers[0].index === attackingPlayerId;
    const opponentBoard = isAttackingPlayer1 ? room.player2Board : room.player1Board;
    const opponentShipStates = isAttackingPlayer1 ? room.player2ShipStates : room.player1ShipStates;

    if (!opponentBoard || !opponentShipStates) return null;
    if (x < 0 || x >= 10 || y < 0 || y >= 10) return null;

    const cellState = opponentBoard[y][x];
    let attackStatus: "miss" | "shot" | "killed" = "miss";
    let hitShipId: number | undefined = undefined;
    let allOpponentShipsSunk = false;
    let sunkShipCellsForResponse: {x:number, y:number}[] | undefined = undefined;


    if (cellState === 0) {
        opponentBoard[y][x] = 2;
        attackStatus = "miss";
    } else if (cellState === 1) {
        opponentBoard[y][x] = 3;
        attackStatus = "shot";

        const hitShip = opponentShipStates.find(ship => ship.cells.some(cell => cell.x === x && cell.y === y));
        if (hitShip) {
            hitShipId = hitShip.id;
            hitShip.hits++;
            if (hitShip.hits === hitShip.length) {
                hitShip.isSunk = true;
                attackStatus = "killed";
                markCellsAroundSunkShip(opponentBoard, hitShip);
                sunkShipCellsForResponse = [];
                hitShip.cells.forEach(sc => {
                    sunkShipCellsForResponse?.push({x: sc.x, y: sc.y});
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ny = sc.y + dy;
                            const nx = sc.x + dx;
                            if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && opponentBoard[ny][nx] === 5) {
                                sunkShipCellsForResponse?.push({x: nx, y: ny});
                            }
                        }
                    }
                });


                allOpponentShipsSunk = opponentShipStates.every(ship => ship.isSunk);
            }
        }
    } else if (cellState === 2 || cellState === 3 || cellState === 4 || cellState === 5) {
        attackStatus = "miss";
    }

    return { status: attackStatus, hitShipId, allSunk: allOpponentShipsSunk, sunkShipCells: sunkShipCellsForResponse };
}

export function checkAllShipsSunk(roomId: string, playerIdToCheck: string): boolean {
    const room = findRoomById(roomId);
    if (!room) return false;
    const playerShipStates = room.roomUsers[0].index === playerIdToCheck ? room.player1ShipStates : room.player2ShipStates;
    if (!playerShipStates) return false;
    return playerShipStates.every(ship => ship.isSunk);
}
