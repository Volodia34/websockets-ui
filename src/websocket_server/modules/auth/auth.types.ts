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
