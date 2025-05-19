export interface ShipData {
    position: { x: number; y: number };
    direction: boolean;
    length: number;
    type: "small" | "medium" | "large" | "huge";
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

export interface AttackResponseData {
    position: {x: number, y: number};
    status: 'miss' | 'shot' | 'killed';
    currentPlayer: string;
    shipField?: ShipData[];
    winPlayer?: string | null;
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

export type GameBoard = number[][];

export interface PlayerGameState {
    playerId: string;
    board: GameBoard;
    ships: ShipData[];
    isReady: boolean;
}
