import { WebSocket } from 'ws';
export function broadcastToAll(wssInstance, messageObject) {
    if (!wssInstance || !wssInstance.clients) {
        console.error('broadcastToAll: wssInstance or wssInstance.clients is undefined');
        return;
    }
    const messageString = JSON.stringify(messageObject);
    wssInstance.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(messageString);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown broadcast error';
                console.error('Error sending message to client during broadcast:', errorMessage);
            }
        }
    });
}
export function generateConnectionId() {
    return Math.random().toString(36).substring(2, 15);
}
