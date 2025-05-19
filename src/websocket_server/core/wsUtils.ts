import { WebSocket, WebSocketServer } from 'ws';

export function broadcastToAll(wssInstance: WebSocketServer, messageObject: any): void {
    if (!wssInstance || !wssInstance.clients) {
        console.error('broadcastToAll: wssInstance or wssInstance.clients is undefined');
        return;
    }
    const messageString = JSON.stringify(messageObject);
    wssInstance.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(messageString);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown broadcast error';
                console.error('Error sending message to client during broadcast:', errorMessage);
            }
        }
    });
}

export function generateConnectionId(): string {
    return Math.random().toString(36).substring(2, 15);
}
