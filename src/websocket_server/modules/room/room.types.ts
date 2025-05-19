import {CellState, ShipHealth} from '../../types.js';
import {ShipData} from "../game/game.types.js";

export interface GameRoomUser {
    name: string;
    index: string;
}

export interface GameRoom {
    roomId: string;
    roomUsers: GameRoomUser[];
    player1Ships?: ShipData[] | null;
    player2Ships?: ShipData[] | null;
    player1Board?: CellState[][];
    player2Board?: CellState[][];
    shipsReadyCount?: number;
    currentPlayerTurn?: string | null;
    player1ShipStates?: ShipHealth[];
    player2ShipStates?: ShipHealth[];
    isGameActive?: boolean;
}

export interface AddUserToRoomClientData {
    indexRoom: string;
}

export interface CreateGameResponseData {
    idGame: string;
    idPlayer: string;
}
