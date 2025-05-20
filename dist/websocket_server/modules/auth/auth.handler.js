import { authServiceInstance } from './auth.service.js';
import { winnersDB, gameRoomsDB } from '../../db.js';
import { broadcastToAll } from '../../core/wsUtils.js';
export class AuthHandler {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    handleRegistration(ws, wss, regClientData, messageId, connectionId) {
        const authResult = this.authService.registerOrLogin(regClientData, connectionId);
        if (!authResult.error && authResult.index) {
            ws.playerId = authResult.index;
            console.log(`[${connectionId}] Associated ws with playerId: ${authResult.index}`);
        }
        ws.send(JSON.stringify({ type: 'reg', data: JSON.stringify(authResult), id: messageId }));
        if (!authResult.error) {
            const winnersPayload = [...winnersDB];
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
