import { StormHttpClient, StormHttpError } from './http.js';
import { logMethodCall } from './logger.js';
import type {
  StormClientConfig,
  OpenPositionRequest,
  ClosePositionRequest,
  CreateOrderRequest,
  ExecuteResponse,
  Deal,
  Order,
  StrategyInfo,
  PortfolioResponse,
  OperationResponse,
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

  // ── Strategy info ────────────────────────────────────────────────────────

  async getStrategyInfo(): Promise<StrategyInfo> {
    logMethodCall('getStrategyInfo');
    return this.http.get<StrategyInfo>('/agent/strategy');
  }

  // ── Portfolio / positions ────────────────────────────────────────────────

  async getPortfolio(): Promise<PortfolioResponse> {
    logMethodCall('getPortfolio');
    return this.http.get<PortfolioResponse>('/agent/portfolio');
  }

  // ── Markets ──────────────────────────────────────────────────────────────

  /**
   * Fetch available markets from Storm Trade API.
   * Filters TON-settlement markets by default.
   */
  async getAvailableMarkets(): Promise<Array<{ pair: string; settlement: string; baseAsset: string }>> {
    logMethodCall('getAvailableMarkets');
    const res = await fetch('https://api5.storm.tg/api/markets');
    if (!res.ok) throw new Error(`Storm API error: ${res.status}`);
    const markets = await res.json() as Array<{ config: { name: string; baseAsset: string; quoteAsset: string; settlementToken: string } }>;
    return markets.map(m => ({
      pair: m.config.name,
      settlement: m.config.settlementToken,
      baseAsset: m.config.baseAsset,
    }));
  }

  // ── Trade execution via /agent/execute ───────────────────────────────────

  /**
   * Open a new futures position via /agent/execute.
   * The backend routes to Storm Trade based on strategy protocol.
   */
  async openPosition(req: OpenPositionRequest): Promise<ExecuteResponse> {
    logMethodCall('openPosition', { direction: req.direction, pair: req.pair, leverage: req.leverage });

    if (req.leverage < 2 || req.leverage > 100) {
      throw new Error(`Leverage must be between 2 and 100, got ${req.leverage}`);
    }
    if (req.amount <= 0) {
      throw new Error(`Amount must be positive, got ${req.amount}`);
    }

    return this.http.post<ExecuteResponse>('/agent/execute', {
      action: 'open',
      direction: req.direction,
      pair: req.pair,
      leverage: req.leverage,
      amount: req.amount,
      margin: req.margin,
      deal_type: req.deal_type,
      limit_price: req.limit_price ?? 0,
      stop_trigger_price: req.stop_trigger_price ?? 0,
      stop_loss_price: req.stop_loss_price ?? 0,
      take_profit_price: req.take_profit_price ?? 0,
      entry_price: req.entry_price ?? 0,
      el_price: req.el_price ?? 0,
      stop_price: req.stop_price ?? 0,
    });
  }

  /**
   * Close an existing position via /agent/execute.
   */
  async closePosition(req: ClosePositionRequest): Promise<ExecuteResponse> {
    logMethodCall('closePosition', { id: req.id, amount: req.amount });
    return this.http.post<ExecuteResponse>('/agent/execute', {
      action: 'close',
      id: req.id,
      amount: req.amount,
    });
  }

  /**
   * Create a TP/SL order via /agent/execute.
   */
  async createOrder(req: CreateOrderRequest): Promise<ExecuteResponse> {
    logMethodCall('createOrder', { order_type: req.order_type, baseAsset: req.baseAsset });
    return this.http.post<ExecuteResponse>('/agent/execute', {
      action: 'create_order',
      order_type: req.order_type,
      marginIn: req.marginIn,
      baseAsset: req.baseAsset,
      direction: req.direction,
      amount: req.amount,
      triggerPrice: req.triggerPrice,
    });
  }

  // ── Read operations via /agent/execute ────────────────────────────────────

  async getOpenDeals(): Promise<Deal[]> {
    logMethodCall('getOpenDeals');
    return this.http.post<Deal[]>('/agent/execute', {
      action: 'get_deals',
    });
  }

  async getAllDeals(): Promise<Deal[]> {
    logMethodCall('getAllDeals');
    return this.http.post<Deal[]>('/agent/execute', {
      action: 'get_all_deals',
    });
  }

  async getOrders(limit = 20, offset = 0): Promise<Order[]> {
    logMethodCall('getOrders', { limit, offset });
    return this.http.post<Order[]>('/agent/execute', {
      action: 'get_orders',
      limit,
      offset,
    });
  }

  // ── Operation status ─────────────────────────────────────────────────────

  async getOperationStatus(operationId: string): Promise<OperationResponse> {
    logMethodCall('getOperationStatus', { operationId });
    return this.http.get<OperationResponse>(`/agent/operation/${operationId}`);
  }

  /**
   * Wait for an operation to reach a terminal status.
   * Handles transient network errors gracefully.
   */
  async waitForConfirmation(
    operationId: string,
    intervalMs = 3000,
    timeoutMs = 120_000,
  ): Promise<OperationResponse> {
    logMethodCall('waitForConfirmation', { operationId, intervalMs, timeoutMs });
    const start = Date.now();
    let consecutiveErrors = 0;

    while (Date.now() - start < timeoutMs) {
      try {
        const status = await this.getOperationStatus(operationId);
        consecutiveErrors = 0;
        if (status.operation_status !== 'pending') return status;
      } catch (err) {
        consecutiveErrors++;
        if (err instanceof StormHttpError && err.status === 404) {
          throw new Error(`Operation ${operationId} not found`);
        }
        if (consecutiveErrors >= 5) {
          throw new Error(`Too many consecutive errors polling operation ${operationId}: ${err}`);
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Timeout waiting for operation ${operationId} after ${timeoutMs}ms`);
  }
}
