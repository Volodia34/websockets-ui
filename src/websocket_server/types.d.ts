
export interface Winner {
    name: string;
    wins: number;
}

export interface ClientMessage {
    type: string;
    data: string;
    id: number;
}


export interface GameRoomUser {
    name: string;
    index: string;
}

export type CellState = 0 | 1 | 2 | 3 | 4 | 5;

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

export interface ShipData {
    position: { x: number; y: number };
    direction: boolean;
    length: number;
    type: "small" | "medium" | "large" | "huge";
}

export interface ShipHealth extends ShipData {
    id: number;
    hits: number;
    isSunk: boolean;
    cells: {x: number, y: number}[];
}


export interface AddUserToRoomClientData {
    indexRoom: string;
}

export interface CreateGameResponseData {
    idGame: string;
    idPlayer: string;
}

export interface AddShipsClientData {
    gameId: string;
    ships: ShipData[];
    indexPlayer: string;
}

export interface StartGameResponseData {
    ships: ShipData[];
    currentPlayerIndex: string;
}

export interface TurnResponseData {
    currentPlayer: string;
}

export interface AttackClientData {
    gameId: string;
    x: number;
    y: number;
    indexPlayer: string;
}

export type AttackStatus = "miss" | "killed" | "shot";

export interface AttackResponseData {
    position: { x: number; y: number };
    currentPlayer: string;
    status: AttackStatus;
}

export interface FinishResponseData {
    winPlayer: string;
}
