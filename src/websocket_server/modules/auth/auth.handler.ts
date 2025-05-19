import { WebSocket, WebSocketServer } from 'ws';
import { AuthService, authServiceInstance } from './auth.service.js';
import { RegClientData } from './auth.types.js';
import { winnersDB, gameRoomsDB } from '../../db.js';
import { GameRoom, Winner } from '../../types.js';
import { broadcastToAll } from '../../core/wsUtils.js';

export class AuthHandler {
    constructor(private authService: AuthService) {}

    public handleRegistration(
        ws: WebSocket,
        wss: WebSocketServer,
        regClientData: RegClientData,
        messageId: number,
        connectionId: string
    ): void {
        const authResult = this.authService.registerOrLogin(regClientData, connectionId);

        if (!authResult.error && authResult.index) {
            (ws as any).playerId = authResult.index;
            console.log(`[${connectionId}] Associated ws with playerId: ${authResult.index}`);
        }

        ws.send(JSON.stringify({ type: 'reg', data: JSON.stringify(authResult), id: messageId }));

        if (!authResult.error) {
            const winnersPayload: Winner[] = [...winnersDB];
            broadcastToAll(wss, {
                type: "update_winners",
                data: JSON.stringify(winnersPayload),
                id: 0,
            });
            console.log(`[Broadcast][${connectionId}] Sent 'update_winners'.`);

            const roomsForUpdate = gameRoomsDB
                .filter(room => room.roomUsers.length === 1)
                .map(room => ({
                    roomId: room.roomId,
                    roomUsers: room.roomUsers.map(user => ({ name: user.name, index: user.index }))
                }));
            broadcastToAll(wss, {
                type: "update_room",
                data: JSON.stringify(roomsForUpdate),
                id: 0,
            });
            console.log(`[Broadcast][${connectionId}] Sent 'update_room'.`);
        }
    }
}


export const authHandlerInstance = new AuthHandler(authServiceInstance);
