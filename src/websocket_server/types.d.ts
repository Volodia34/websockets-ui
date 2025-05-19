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

export interface GameRoom {
    roomId: string;
    roomUsers: { name: string; index: string }[];
}

export interface ShipData {
    position: { x: number; y: number };
    direction: boolean;
    length: number;
    type: "small" | "medium" | "large" | "huge";
}
