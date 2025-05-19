import { WebSocket, WebSocketServer } from 'ws';
import { AddShipsClientData } from '../types.js';

export function handleAddShips(
    ws: WebSocket,
    wss: WebSocketServer,
    clientData: AddShipsClientData,
    messageId: number,
    connectionId: string
): void {

}
