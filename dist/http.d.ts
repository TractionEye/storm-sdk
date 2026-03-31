export declare class StormHttpError extends Error {
    readonly status: number;
    readonly body?: unknown | undefined;
    constructor(message: string, status: number, body?: unknown | undefined);
}
export declare class StormHttpClient {
    private readonly baseUrl;
    private readonly agentToken;
    constructor(baseUrl: string, agentToken: string);
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    private _request;
}
