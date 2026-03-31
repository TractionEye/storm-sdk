import type { StormClient } from './client.js';
type Tool = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
};
export declare function createStormTools(client: StormClient): Tool[];
export {};
