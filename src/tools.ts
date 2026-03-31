import type { StormClient } from './client.js';
import { AVAILABLE_MARKETS } from './types.js';
import { StormHttpError } from './http.js';

type Tool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

function wrapError(err: unknown): { error: string; code?: number } {
  if (err instanceof StormHttpError) {
    return { error: err.message, code: err.status };
  }
  if (err instanceof Error) {
    return { error: err.message };
  }
  return { error: String(err) };
}

function requireNumber(args: Record<string, unknown>, key: string): number {
  const val = Number(args[key]);
  if (!Number.isFinite(val)) throw new Error(`${key} must be a finite number, got ${args[key]}`);
  return val;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const val = args[key];
  if (typeof val !== 'string' || !val) throw new Error(`${key} is required`);
  return val;
}

export function createStormTools(client: StormClient): Tool[] {
  return [
    // ── Read tools ───────────────────────────────────────────────────────

    {
      name: 'storm_get_strategy_info',
      description:
        'Get strategy summary: TON balance in strategy, daily/weekly/monthly/yearly PnL, win rate, trades per week, max drawdown, low balance state. Call this FIRST to understand available capital before sizing positions.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        try {
          return await client.getStrategyInfo();
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_get_open_positions',
      description:
        'Get all open futures positions for the strategy. Returns a list of deals with direction (long/short), asset, leverage, margin, entry price, PnL, TP/SL prices, and swap status. Use this to see what positions are currently active before opening new ones.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        try {
          return await client.getOpenDeals();
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_get_all_deals',
      description:
        'Get all deals including closed ones. Use this to review full trade history, calculate cumulative PnL, and learn from past trades. Closed deals have closed_at != null.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        try {
          return await client.getAllDeals();
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_get_aggregated_positions',
      description:
        'Get positions grouped by token. Shows total amount, total TON invested, realized PnL, and entry price per asset. Useful for portfolio overview.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => {
        try {
          return await client.getAggregatedPositions();
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_get_orders',
      description:
        'Get TP/SL order history with pagination. Returns trigger prices, sizes, statuses, and directions.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max orders to return (default 20)' },
          offset: { type: 'number', description: 'Skip first N orders (default 0)' },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        try {
          return await client.getOrders(
            (args.limit as number) ?? 20,
            (args.offset as number) ?? 0,
          );
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_get_available_markets',
      description:
        'Get the list of supported trading pairs on Storm Trade. Each market has a pair name (e.g. "BTC/USD"), settlement token (TON, USDT, NOT), and type (coinm or base). Use this before opening a position to verify the pair exists. Note: this list may not include all pairs — Storm Trade adds markets over time.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      handler: async () => AVAILABLE_MARKETS,
    },

    {
      name: 'storm_get_swap_status',
      description:
        'Check the status of an async deal after opening or closing a position. Statuses: "pending" = waiting for on-chain settlement, "confirmed" = done, "failed" = error (check error field), "adjusted" = confirmed but amounts differ from expected.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'number', description: 'The deal ID returned by open/close position' },
        },
        required: ['deal_id'],
        additionalProperties: false,
      },
      handler: async (args) => {
        try {
          const dealId = requireNumber(args, 'deal_id');
          return await client.getSwapStatus(dealId);
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    // ── Write tools ──────────────────────────────────────────────────────

    {
      name: 'storm_open_position',
      description:
        'Open a new futures position on Storm Trade. Specify direction (long/short), pair (e.g. "BTC/USD"), leverage (2-100), and collateral amount in nanoTON (1 TON = 1,000,000,000 nanoTON). Optionally set stop_loss_price and take_profit_price in USD. Returns a deal ID — use storm_wait_confirmation to wait for on-chain settlement. UNITS: amount = collateral in nanoTON. stop_loss_price/take_profit_price = USD. limit_price/stop_trigger_price = nanoTON.',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['long', 'short'], description: 'Position direction' },
          pair: { type: 'string', description: 'Trading pair, e.g. "BTC/USD", "ETH/USD", "TON/USD"' },
          leverage: { type: 'number', description: 'Leverage multiplier (2–100)' },
          amount: { type: 'number', description: 'Collateral (margin deposit) in nanoTON' },
          deal_type: { type: 'string', enum: ['market', 'stopLimit'], description: 'Order type (default "market")' },
          stop_loss_price: { type: 'number', description: 'Stop loss price in USD (optional)' },
          take_profit_price: { type: 'number', description: 'Take profit price in USD (optional)' },
          limit_price: { type: 'number', description: 'Limit price in nanoTON for limit orders (optional)' },
          stop_trigger_price: { type: 'number', description: 'Stop trigger price in nanoTON (optional)' },
        },
        required: ['direction', 'pair', 'leverage', 'amount'],
        additionalProperties: false,
      },
      handler: async (args) => {
        try {
          const amount = requireNumber(args, 'amount');
          const leverage = requireNumber(args, 'leverage');
          const direction = requireString(args, 'direction') as 'long' | 'short';
          const pair = requireString(args, 'pair');

          if (direction !== 'long' && direction !== 'short') {
            return { error: `direction must be "long" or "short", got "${direction}"` };
          }
          if (amount <= 0) return { error: `amount must be positive, got ${amount}` };
          if (leverage < 2 || leverage > 100) return { error: `leverage must be 2–100, got ${leverage}` };

          return await client.openPosition({
            direction,
            pair,
            leverage,
            amount,
            margin: amount,
            deal_type: (args.deal_type as 'market' | 'stopLimit') ?? 'market',
            stop_loss_price: (args.stop_loss_price as number) ?? 0,
            take_profit_price: (args.take_profit_price as number) ?? 0,
            limit_price: (args.limit_price as number) ?? 0,
            stop_trigger_price: (args.stop_trigger_price as number) ?? 0,
            stop_price: 0,
            entry_price: 0,
            el_price: 0,
          });
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_close_position',
      description:
        'Close an existing futures position (fully or partially). Provide the deal ID and amount in nanoTON. For full close, use the full margin amount of the position. Returns status "pending" — use storm_wait_confirmation to wait for on-chain settlement.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Deal ID to close' },
          amount: { type: 'number', description: 'Amount to close in nanoTON (full margin for full close)' },
        },
        required: ['id', 'amount'],
        additionalProperties: false,
      },
      handler: async (args) => {
        try {
          const id = requireNumber(args, 'id');
          const amount = requireNumber(args, 'amount');
          if (amount <= 0) return { error: `amount must be positive, got ${amount}` };
          return await client.closePosition({ id, amount });
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_create_order',
      description:
        'Create a Take Profit or Stop Loss order for an existing open position. Specify order_type ("takeProfit" or "stopLoss"), base asset (e.g. "BTC"), direction of the position, margin in nanoTON, order size in nanoTON, and trigger price in nanoTON. IMPORTANT: triggerPrice is in nanoTON, NOT USD.',
      parameters: {
        type: 'object',
        properties: {
          order_type: { type: 'string', enum: ['takeProfit', 'stopLoss'], description: 'Order type' },
          baseAsset: { type: 'string', description: 'Base asset: "BTC", "ETH", "TON", etc.' },
          direction: { type: 'string', enum: ['long', 'short'], description: 'Direction of the position' },
          marginIn: { type: 'number', description: 'Margin in nanoTON' },
          amount: { type: 'number', description: 'Order size in nanoTON' },
          triggerPrice: { type: 'number', description: 'Trigger price in nanoTON (NOT USD)' },
        },
        required: ['order_type', 'baseAsset', 'direction', 'marginIn', 'amount', 'triggerPrice'],
        additionalProperties: false,
      },
      handler: async (args) => {
        try {
          return await client.createOrder({
            order_type: requireString(args, 'order_type') as 'takeProfit' | 'stopLoss',
            baseAsset: requireString(args, 'baseAsset'),
            direction: requireString(args, 'direction') as 'long' | 'short',
            marginIn: requireNumber(args, 'marginIn'),
            amount: requireNumber(args, 'amount'),
            triggerPrice: requireNumber(args, 'triggerPrice'),
          });
        } catch (err) {
          return wrapError(err);
        }
      },
    },

    {
      name: 'storm_wait_confirmation',
      description:
        'Wait for a deal to be confirmed on-chain. Polls status every 3 seconds until the deal reaches a terminal state (confirmed/failed/adjusted) or times out after 120 seconds. Use after storm_open_position or storm_close_position. If you prefer manual polling, use storm_get_swap_status instead.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'number', description: 'Deal ID to wait for' },
        },
        required: ['deal_id'],
        additionalProperties: false,
      },
      handler: async (args) => {
        try {
          const dealId = requireNumber(args, 'deal_id');
          return await client.waitForConfirmation(dealId);
        } catch (err) {
          return wrapError(err);
        }
      },
    },
  ];
}
