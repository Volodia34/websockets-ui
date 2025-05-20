import { PlayerService, playerServiceInstance } from '../player/player.service.js';
import { RegClientData, RegResponseData } from './auth.types.js';

export interface AuthResult extends RegResponseData {}

export class AuthService {
    constructor(private playerService: PlayerService) {}

    public registerOrLogin(regClientData: RegClientData, connectionIdForLogging: string): AuthResult {
        const { name: playerName, password: playerPassword } = regClientData;

        if (
            !playerName || typeof playerName !== 'string' || playerName.trim() === '' ||
            !playerPassword || typeof playerPassword !== 'string' || playerPassword.trim() === ''
        ) {
            console.warn(`[${connectionIdForLogging}] Invalid registration data: name or password empty.`);
            return {
                name: playerName || '',
                index: '',
                error: true,
                errorText: 'Name and password are required and cannot be empty.',
            };
        }

        const existingPlayer = this.playerService.findByName(playerName);

        if (existingPlayer) {
            if (existingPlayer.password === playerPassword) {
                console.log(`[${connectionIdForLogging}] Player ${playerName} (ID: ${existingPlayer.id}) logged in.`);
                return {
                    name: existingPlayer.name,
                    index: existingPlayer.id,
                    error: false,
                    errorText: '',
                };
            } else {
                console.log(`[${connectionIdForLogging}] Incorrect password for player ${playerName}.`);
                return {
                    name: playerName,
                    index: '',
                    error: true,
                    errorText: 'Incorrect password',
                };
            }
        } else {
            const newPlayer = this.playerService.createPlayer(playerName, playerPassword);
            console.log(`[${connectionIdForLogging}] Player ${playerName} registered with ID ${newPlayer.id}.`);
            return {
                name: newPlayer.name,
                index: newPlayer.id,
                error: false,
                errorText: '',
            };
        }
    }
}

export const authServiceInstance = new AuthService(playerServiceInstance);
