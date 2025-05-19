import { getNextUserIndex, findPlayerByName, addPlayer } from '../db.js';
export function handleRegistration(ws, wss, regClientData, messageId, connectionId) {
    const { name: playerName, password: playerPassword } = regClientData;
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '' ||
        !playerPassword || typeof playerPassword !== 'string' || playerPassword.trim() === '') {
        const errorResponsePayload = {
            name: playerName || '',
            index: '',
            error: true,
            errorText: 'Name and password are required and cannot be empty.',
        };
        ws.send(JSON.stringify({
            type: 'reg',
            data: JSON.stringify(errorResponsePayload),
            id: messageId,
        }));
        return;
    }
    let existingPlayer = findPlayerByName(playerName);
    let responseDataPayload;
    if (existingPlayer) {
        if (existingPlayer.password === playerPassword) {
            responseDataPayload = {
                name: existingPlayer.name,
                index: existingPlayer.id,
                error: false,
                errorText: '',
            };
        }
        else {
            responseDataPayload = {
                name: playerName,
                index: '',
                error: true,
                errorText: 'Incorrect password',
            };
        }
    }
    else {
        const newPlayerId = getNextUserIndex();
        const newPlayer = {
            id: newPlayerId,
            name: playerName,
            password: playerPassword,
        };
        addPlayer(newPlayer);
        responseDataPayload = {
            name: newPlayer.name,
            index: newPlayer.id,
            error: false,
            errorText: '',
        };
    }
    ws.send(JSON.stringify({
        type: 'reg',
        data: JSON.stringify(responseDataPayload),
        id: messageId,
    }));
}
