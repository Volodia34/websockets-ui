import { WebSocket, WebSocketServer } from 'ws';
import { AddUserToRoomClientData } from '../types.js';

export function handleCreateRoom(
    ws: WebSocket,
    wss: WebSocketServer,
    requestingPlayerId: string,
    messageId: number,
    connectionId: string
): void {
    console.log(`[${connectionId}] handleCreateRoom called by PlayerID: ${requestingPlayerId}. Implementation pending.`);
}

export function handleAddUserToRoom(
    ws: WebSocket,
    wss: WebSocketServer,
    joiningPlayerId: string,
    clientData: AddUserToRoomClientData,
    messageId: number,
    connectionId: string
): void {
    console.log(`[${connectionId}] handleAddUserToRoom called by PlayerID: ${joiningPlayerId} for RoomID: ${clientData.indexRoom}. Implementation pending.`);
}
