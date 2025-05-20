export interface ShipData {
    position: { x: number; y: number };
    direction: boolean;
    length: number;
    type: "small" | "medium" | "large" | "huge";
    hits?: number;
    isSunk?: boolean;
}

export interface AddShipsClientData {
    gameId: string;
    ships: ShipData[];
    indexPlayer: string;
}

export interface AttackClientData {
    gameId: string;
    indexPlayer: string;
    x: number;
    y: number;
}

export type CellStatus = 0 | 1 | 2 | 3 | 4 | 5;
export type GameBoard = CellStatus[][];

export interface PlayerBoardState {
    playerId: string;
    board: GameBoard;
    ships: ShipData[];
}

export interface AttackResponseData {
    position: { x: number; y: number };
    status: 'miss' | 'shot' | 'killed';
    currentPlayer: string;
    shipField?: ShipData[];
    winPlayer?: string;
}



export interface AttackClientData {
    gameId: string;
    x: number;
    y: number;
    indexPlayer: string;
}

export type AttackStatus = "miss" | "killed" | "shot";

export interface AttackResult {
    status: 'miss' | 'shot' | 'killed';
    position: { x: number; y: number };
    sunkShip?: ShipData;
    sunkShipCells?: Array<{x:number, y:number, status: CellStatus}>;
}

export interface AttackServiceResult {
    success: boolean;
    message?: string;
    attackResult?: AttackResult;
    nextPlayerId?: string | null;
    winnerId?: string | null;
    room?: import('../room/room.types.js').GameRoom;
}


export interface StartGameDataToClient {
    ships: ShipData[];
    currentPlayerIndex: string;
    gameId: string;
}

export interface TurnDataToClient {
    currentPlayer: string;
    gameId: string;
}



export interface PlayerGameState {
    playerId: string;
    board: GameBoard;
    ships: ShipData[];
    isReady: boolean;
}



