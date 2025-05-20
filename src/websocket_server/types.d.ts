
export interface Winner {
    name: string;
    wins: number;
}

export interface ClientMessage {
    type: string;
    data: string;
    id: number;
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

export interface ShipHealth extends ShipData {
    id: number;
    hits: number;
    isSunk: boolean;
    cells: {x: number, y: number}[];
    length: number;
}



export interface FinishResponseData {
    winPlayer: string;
}
