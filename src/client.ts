import { StormHttpClient } from './http.js';
import type {
  StormClientConfig,
  OpenPositionRequest,
  OpenPositionResponse,
  ClosePositionRequest,
  ClosePositionResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  Deal,
  Order,
  AggregatedPosition,
  SwapStatus,
} from './types.js';

const DEFAULT_BASE_URL = 'https://test.tractioneye.xyz/trust_api';

type StrategyInfo = {
  strategy_id: number;
  strategy_name: string;
};

export class StormClient {
  private readonly http: StormHttpClient;
  public readonly strategyId: string;

  private constructor(http: StormHttpClient, strategyId: string) {
    this.http = http;
    this.strategyId = strategyId;
  }

  /**
   * Create a StormClient. Validates the agent token by fetching strategy info.
   */
  static async create(config: StormClientConfig): Promise<StormClient> {
    const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    const http = new StormHttpClient(baseUrl, config.agentToken);
    const info = await http.get<StrategyInfo>('/agent/strategy');
    return new StormClient(http, String(info.strategy_id));
  }

  private path(suffix: string): string {
    return `/strategy/${this.strategyId}${suffix}`;
  }

  // ── Positions ────────────────────────────────────────────────────────────

  /**
   * Open a new futures position (long or short).
   * Amount and margin are in nanoTON (1 TON = 1_000_000_000).
   * Leverage range: 2–100.
   */
  async openPosition(req: OpenPositionRequest): Promise<OpenPositionResponse> {
    return this.http.post<OpenPositionResponse>(this.path('/deal/open'), {
      amount: req.amount,
      direction: req.direction,
      pair: req.pair,
      leverage: req.leverage,
      deal_type: req.deal_type,
      limit_price: req.limit_price ?? 0,
      stop_trigger_price: req.stop_trigger_price ?? 0,
      stop_loss_price: req.stop_loss_price ?? 0,
      take_profit_price: req.take_profit_price ?? 0,
      entry_price: req.entry_price ?? 0,
      el_price: req.el_price ?? 0,
      margin: req.margin,
      stop_price: req.stop_price ?? 0,
    });
  }

  /**
   * Close an existing position (fully or partially).
   * For full close, set amount = full margin of the position.
   */
  async closePosition(req: ClosePositionRequest): Promise<ClosePositionResponse> {
    return this.http.post<ClosePositionResponse>(this.path('/deal/close'), {
      id: req.id,
      amount: req.amount,
    });
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  /**
   * Create a Take Profit or Stop Loss order for an existing position.
   */
  async createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(this.path('/deal/create_order'), {
      order_type: req.order_type,
      marginIn: req.marginIn,
      baseAsset: req.baseAsset,
      direction: req.direction,
      amount: req.amount,
      triggerPrice: req.triggerPrice,
    });
  }

  /**
   * Get order history with pagination.
   */
  async getOrders(limit = 20, offset = 0): Promise<Order[]> {
    return this.http.post<Order[]>(this.path('/orders'), { limit, offset });
  }

  // ── Deals (read) ─────────────────────────────────────────────────────────

  /**
   * Get open (unclosed) deals for the strategy.
   */
  async getOpenDeals(): Promise<Deal[]> {
    return this.http.get<Deal[]>(this.path('/deals'));
  }

  /**
   * Get all deals including closed ones.
   */
  async getAllDeals(): Promise<Deal[]> {
    return this.http.get<Deal[]>(this.path('/deals/all'));
  }

  /**
   * Get aggregated positions grouped by token.
   */
  async getAggregatedPositions(): Promise<AggregatedPosition[]> {
    return this.http.get<AggregatedPosition[]>(this.path('/deals/aggregated'));
  }

  // ── Status polling ───────────────────────────────────────────────────────

  /**
   * Poll the status of an async deal (open or close).
   * Statuses: pending → confirmed | failed | adjusted
   */
  async getSwapStatus(dealId: number): Promise<SwapStatus> {
    return this.http.get<SwapStatus>(this.path(`/swap/status/${dealId}`));
  }

  /**
   * Wait for a deal to reach a terminal status.
   * Polls every `intervalMs` (default 3s), times out after `timeoutMs` (default 120s).
   */
  async waitForConfirmation(
    dealId: number,
    intervalMs = 3000,
    timeoutMs = 120_000,
  ): Promise<SwapStatus> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getSwapStatus(dealId);
      if (status.status !== 'pending') return status;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Timeout waiting for deal ${dealId} confirmation after ${timeoutMs}ms`);
  }
}
