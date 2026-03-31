import type { StormClientConfig, OpenPositionRequest, ClosePositionRequest, CreateOrderRequest, ExecuteResponse, Deal, Order, StrategyInfo, PortfolioResponse, OperationResponse } from './types.js';
export declare class StormClient {
    private readonly http;
    readonly strategyId: string;
    readonly strategyName: string;
    private constructor();
    /**
     * Create a StormClient. Validates the agent token by fetching strategy info.
     */
    static create(config: StormClientConfig): Promise<StormClient>;
    getStrategyInfo(): Promise<StrategyInfo>;
    getPortfolio(): Promise<PortfolioResponse>;
    /**
     * Fetch available markets from Storm Trade API.
     * Filters TON-settlement markets by default.
     */
    getAvailableMarkets(): Promise<Array<{
        pair: string;
        settlement: string;
        baseAsset: string;
    }>>;
    /**
     * Open a new futures position via /agent/execute.
     * The backend routes to Storm Trade based on strategy protocol.
     */
    openPosition(req: OpenPositionRequest): Promise<ExecuteResponse>;
    /**
     * Close an existing position via /agent/execute.
     */
    closePosition(req: ClosePositionRequest): Promise<ExecuteResponse>;
    /**
     * Create a TP/SL order via /agent/execute.
     */
    createOrder(req: CreateOrderRequest): Promise<ExecuteResponse>;
    getOpenDeals(): Promise<Deal[]>;
    getAllDeals(): Promise<Deal[]>;
    getOrders(limit?: number, offset?: number): Promise<Order[]>;
    getOperationStatus(operationId: string): Promise<OperationResponse>;
    /**
     * Wait for an operation to reach a terminal status.
     * Handles transient network errors gracefully.
     */
    waitForConfirmation(operationId: string, intervalMs?: number, timeoutMs?: number): Promise<OperationResponse>;
}
