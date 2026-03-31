import type { StormClientConfig, OpenPositionRequest, OpenPositionResponse, ClosePositionRequest, ClosePositionResponse, CreateOrderRequest, CreateOrderResponse, Deal, Order, AggregatedPosition, SwapStatus, StrategyInfo } from './types.js';
export declare class StormClient {
    private readonly http;
    readonly strategyId: string;
    readonly strategyName: string;
    private constructor();
    /**
     * Create a StormClient. Validates the agent token by fetching strategy info.
     */
    static create(config: StormClientConfig): Promise<StormClient>;
    private path;
    /**
     * Get strategy summary: balance, PnL, win rate, drawdown.
     */
    getStrategyInfo(): Promise<StrategyInfo>;
    /**
     * Open a new futures position (long or short).
     * `amount` = collateral (margin deposit) in nanoTON.
     * `margin` = same as amount (collateral). The API uses both fields.
     * Leverage range: 2–100. Prices: stop_loss/take_profit in USD.
     */
    openPosition(req: OpenPositionRequest): Promise<OpenPositionResponse>;
    /**
     * Close an existing position (fully or partially).
     * For full close, set amount = full margin of the position.
     */
    closePosition(req: ClosePositionRequest): Promise<ClosePositionResponse>;
    /**
     * Create a Take Profit or Stop Loss order for an existing position.
     */
    createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse>;
    /**
     * Get order history with pagination.
     */
    getOrders(limit?: number, offset?: number): Promise<Order[]>;
    /**
     * Get open (unclosed) deals for the strategy.
     */
    getOpenDeals(): Promise<Deal[]>;
    /**
     * Get all deals including closed ones.
     */
    getAllDeals(): Promise<Deal[]>;
    /**
     * Get aggregated positions grouped by token.
     */
    getAggregatedPositions(): Promise<AggregatedPosition[]>;
    /**
     * Poll the status of an async deal (open or close).
     * Statuses: pending → confirmed | failed | adjusted
     */
    getSwapStatus(dealId: number): Promise<SwapStatus>;
    /**
     * Wait for a deal to reach a terminal status.
     * Handles transient network errors gracefully (retries within timeout).
     * Polls every `intervalMs` (default 3s), times out after `timeoutMs` (default 120s).
     */
    waitForConfirmation(dealId: number, intervalMs?: number, timeoutMs?: number): Promise<SwapStatus>;
}
