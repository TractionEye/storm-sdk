// ─── Config ──────────────────────────────────────────────────────────────

export interface StormClientConfig {
  agentToken: string;
  baseUrl?: string;
}

// ─── Open position ───────────────────────────────────────────────────────

export interface OpenPositionRequest {
  /** Margin in nanoTON (1 TON = 1_000_000_000) */
  amount: number;
  /** "long" or "short" */
  direction: 'long' | 'short';
  /** Trading pair: "BTC/USD", "ETH/USD", "TON/USD", etc. */
  pair: string;
  /** Leverage multiplier (2.0–100.0) */
  leverage: number;
  /** "market" or "stopLimit" */
  deal_type: 'market' | 'stopLimit';
  /** Limit price in nanoTON (for limit orders, 0 otherwise) */
  limit_price?: number;
  /** Stop trigger price in nanoTON */
  stop_trigger_price?: number;
  /** Stop loss price in USD */
  stop_loss_price?: number;
  /** Take profit price in USD */
  take_profit_price?: number;
  /** Desired entry price in USD */
  entry_price?: number;
  /** Estimated liquidation price in USD */
  el_price?: number;
  /** Margin in nanoTON */
  margin: number;
  /** Stop price in nanoTON */
  stop_price?: number;
}

export interface OpenPositionResponse {
  id: number;
  error_code: number;
  error: string;
}

// ─── Close position ──────────────────────────────────────────────────────

export interface ClosePositionRequest {
  /** Deal ID to close */
  id: number;
  /** Amount to close in nanoTON (full margin for full close) */
  amount: number;
}

export interface ClosePositionResponse {
  status: 'pending' | 'error';
  error_code: number;
  error: string;
}

// ─── Create TP/SL order ──────────────────────────────────────────────────

export interface CreateOrderRequest {
  /** "takeProfit" or "stopLoss" */
  order_type: 'takeProfit' | 'stopLoss';
  /** Margin in nanoTON */
  marginIn: number;
  /** Base asset: "BTC", "ETH", "TON", etc. */
  baseAsset: string;
  /** "long" or "short" */
  direction: 'long' | 'short';
  /** Order size in nanoTON */
  amount: number;
  /** Trigger price in nanoTON */
  triggerPrice: number;
}

export interface CreateOrderResponse {
  status: string;
  error_code: number;
  error: string;
}

// ─── Deal / Position ─────────────────────────────────────────────────────

export interface Deal {
  id: number;
  strategy_id: number;
  amount: number;
  direction: 'long' | 'short';
  asset: string;
  leverage: number;
  margin: number;
  entry_price: number;
  stop_loss_price: number;
  take_profit_price: number;
  deal_type: string;
  swap_status: string;
  opened_at: string;
  closed_at: string | null;
  profit_or_loss: string | null;
}

// ─── Order ───────────────────────────────────────────────────────────────

export interface Order {
  id: string | number;
  asset: string;
  created_at: string;
  size: number;
  trigger_price: number;
  status: string;
  direction: 'long' | 'short';
  order_type: 'take' | 'stop' | 'limit' | 'market' | 'liquidation';
}

// ─── Aggregated position ─────────────────────────────────────────────────

export interface AggregatedPosition {
  token: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  token_image_url: string;
  token_icon: string;
  total_token_amount: number;
  total_ton_amount: number;
  realized_pnl: number;
  entry_price: number;
  initial_purchase_ton: number;
}

// ─── Swap status ─────────────────────────────────────────────────────────

export interface SwapStatus {
  deal_id: number;
  status: 'pending' | 'confirmed' | 'failed' | 'adjusted';
  amount: number;
  token_amount: number | null;
  tx_hash: string | null;
  error: string | null;
  error_code: number;
}

// ─── Available markets ───────────────────────────────────────────────────

export interface Market {
  pair: string;
  settlement: string;
  type: string;
}

export const AVAILABLE_MARKETS: Market[] = [
  { pair: 'BTC/USD', settlement: 'TON', type: 'coinm' },
  { pair: 'ETH/USD', settlement: 'TON', type: 'coinm' },
  { pair: 'TON/USD', settlement: 'TON', type: 'coinm' },
  { pair: 'NOT/USD', settlement: 'NOT', type: 'coinm' },
  { pair: 'TRUMP/USD', settlement: 'TON', type: 'coinm' },
  { pair: 'BTC/USDT', settlement: 'USDT', type: 'base' },
  { pair: 'ETH/USDT', settlement: 'USDT', type: 'base' },
  { pair: 'TON/USDT', settlement: 'USDT', type: 'base' },
];
