export interface Player {
    id: string;
    name: string;
    password: string;
}

export interface Winner {
    name: string;
    wins: number;
}

export interface ClientMessage {
    type: string;
    data: string;
    id: number;
}

export interface RegClientData {
    name: string;
    password: string;
}

export interface RegResponseData {
    name: string;
    index: string;
    error: boolean;
    errorText: string;
}

export interface GameRoomUser {
    name: string;
    index: string;
}

export interface GameRoom {
    roomId: string;
    roomUsers: GameRoomUser[];
    player1Ships?: ShipData[] | null;
    player2Ships?: ShipData[] | null;
    shipsReadyCount?: number;
    currentPlayerTurn?: string | null;
}

export interface AddUserToRoomClientData {
    indexRoom: string;
}

export interface CreateGameResponseData {
    idGame: string;
    idPlayer: string;
}

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

export interface StartGameResponseData {
    ships: ShipData[];
    currentPlayerIndex: string;
}

export interface TurnResponseData {
    currentPlayer: string;
}
