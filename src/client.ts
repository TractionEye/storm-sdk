import { StormHttpClient, StormHttpError } from './http.js';
import { logMethodCall } from './logger.js';
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
  StrategyInfo,
} from './types.js';

const DEFAULT_BASE_URL = 'https://test.tractioneye.xyz/trust_api';

export class StormClient {
  private readonly http: StormHttpClient;
  public readonly strategyId: string;
  public readonly strategyName: string;

  private constructor(http: StormHttpClient, strategyId: string, strategyName: string) {
    this.http = http;
    this.strategyId = strategyId;
    this.strategyName = strategyName;
  }

  /**
   * Create a StormClient. Validates the agent token by fetching strategy info.
   */
  static async create(config: StormClientConfig): Promise<StormClient> {
    if (!config.agentToken) throw new Error('agentToken is required');
    const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    const http = new StormHttpClient(baseUrl, config.agentToken);
    const info = await http.get<StrategyInfo>('/agent/strategy');
    if (info.strategy_id == null) {
      throw new Error('Invalid strategy info: missing strategy_id');
    }
    return new StormClient(http, String(info.strategy_id), info.strategy_name ?? '');
  }

  private path(suffix: string): string {
    return `/strategy/${this.strategyId}${suffix}`;
  }

  // ── Strategy info ────────────────────────────────────────────────────────

  /**
   * Get strategy summary: balance, PnL, win rate, drawdown.
   */
  async getStrategyInfo(): Promise<StrategyInfo> {
    logMethodCall('getStrategyInfo');
    return this.http.get<StrategyInfo>('/agent/strategy');
  }

  // ── Positions ────────────────────────────────────────────────────────────

  /**
   * Open a new futures position (long or short).
   * `amount` = collateral (margin deposit) in nanoTON.
   * `margin` = same as amount (collateral). The API uses both fields.
   * Leverage range: 2–100. Prices: stop_loss/take_profit in USD.
   */
  async openPosition(req: OpenPositionRequest): Promise<OpenPositionResponse> {
    logMethodCall('openPosition', { direction: req.direction, pair: req.pair, leverage: req.leverage });

    if (req.leverage < 2 || req.leverage > 100) {
      throw new Error(`Leverage must be between 2 and 100, got ${req.leverage}`);
    }
    if (req.amount <= 0) {
      throw new Error(`Amount must be positive, got ${req.amount}`);
    }

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
    logMethodCall('closePosition', { id: req.id, amount: req.amount });
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
    logMethodCall('createOrder', { order_type: req.order_type, baseAsset: req.baseAsset });
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
    logMethodCall('getOrders', { limit, offset });
    return this.http.post<Order[]>(this.path('/orders'), { limit, offset });
  }

  // ── Deals (read) ─────────────────────────────────────────────────────────

  /**
   * Get open (unclosed) deals for the strategy.
   */
  async getOpenDeals(): Promise<Deal[]> {
    logMethodCall('getOpenDeals');
    return this.http.get<Deal[]>(this.path('/deals'));
  }

  /**
   * Get all deals including closed ones.
   */
  async getAllDeals(): Promise<Deal[]> {
    logMethodCall('getAllDeals');
    return this.http.get<Deal[]>(this.path('/deals/all'));
  }

  /**
   * Get aggregated positions grouped by token.
   */
  async getAggregatedPositions(): Promise<AggregatedPosition[]> {
    logMethodCall('getAggregatedPositions');
    return this.http.get<AggregatedPosition[]>(this.path('/deals/aggregated'));
  }

  // ── Status polling ───────────────────────────────────────────────────────

  /**
   * Poll the status of an async deal (open or close).
   * Statuses: pending → confirmed | failed | adjusted
   */
  async getSwapStatus(dealId: number): Promise<SwapStatus> {
    logMethodCall('getSwapStatus', { dealId });
    return this.http.get<SwapStatus>(this.path(`/swap/status/${dealId}`));
  }

  /**
   * Wait for a deal to reach a terminal status.
   * Handles transient network errors gracefully (retries within timeout).
   * Polls every `intervalMs` (default 3s), times out after `timeoutMs` (default 120s).
   */
  async waitForConfirmation(
    dealId: number,
    intervalMs = 3000,
    timeoutMs = 120_000,
  ): Promise<SwapStatus> {
    logMethodCall('waitForConfirmation', { dealId, intervalMs, timeoutMs });
    const start = Date.now();
    let consecutiveErrors = 0;

    while (Date.now() - start < timeoutMs) {
      try {
        const status = await this.getSwapStatus(dealId);
        consecutiveErrors = 0;
        if (status.status !== 'pending') return status;
      } catch (err) {
        consecutiveErrors++;
        if (err instanceof StormHttpError && err.status === 404) {
          throw new Error(`Deal ${dealId} not found`);
        }
        if (consecutiveErrors >= 5) {
          throw new Error(`Too many consecutive errors polling deal ${dealId}: ${err}`);
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Timeout waiting for deal ${dealId} confirmation after ${timeoutMs}ms`);
  }
}
