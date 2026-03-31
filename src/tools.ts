import type { StormClient } from './client.js';
import { AVAILABLE_MARKETS } from './types.js';

type Tool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

export function createStormTools(client: StormClient): Tool[] {
  return [
    // ── Read tools ───────────────────────────────────────────────────────

    {
      name: 'storm_get_open_positions',
      description:
        'Get all open futures positions for the strategy. Returns a list of deals with direction (long/short), asset, leverage, margin, entry price, PnL, TP/SL prices, and swap status. Use this to see what positions are currently active.',
      parameters: { type: 'object', properties: {} },
      handler: async () => client.getOpenDeals(),
    },

    {
      name: 'storm_get_all_deals',
      description:
        'Get all deals including closed ones. Use this to review trade history and calculate cumulative PnL.',
      parameters: { type: 'object', properties: {} },
      handler: async () => client.getAllDeals(),
    },

    {
      name: 'storm_get_aggregated_positions',
      description:
        'Get positions grouped by token. Shows total amount, total TON invested, realized PnL, and entry price per asset. Useful for portfolio overview.',
      parameters: { type: 'object', properties: {} },
      handler: async () => client.getAggregatedPositions(),
    },

    {
      name: 'storm_get_orders',
      description:
        'Get order history (Take Profit, Stop Loss, Limit, Market orders) with pagination. Returns trigger prices, sizes, statuses, and directions.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max orders to return (default 20)' },
          offset: { type: 'number', description: 'Skip first N orders (default 0)' },
        },
      },
      handler: async (args) =>
        client.getOrders(
          (args.limit as number) ?? 20,
          (args.offset as number) ?? 0,
        ),
    },

    {
      name: 'storm_get_available_markets',
      description:
        'Get the list of supported trading pairs on Storm Trade. Each market has a pair name (e.g. "BTC/USD"), settlement token (TON, USDT, NOT), and type (coinm or base). Use this before opening a position to verify the pair exists.',
      parameters: { type: 'object', properties: {} },
      handler: async () => AVAILABLE_MARKETS,
    },

    {
      name: 'storm_get_swap_status',
      description:
        'Check the status of an async deal (after opening or closing a position). Statuses: "pending" = waiting for on-chain settlement, "confirmed" = done, "failed" = error, "adjusted" = confirmed but amounts differ from expected. Poll this after open/close until status is not "pending".',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'number', description: 'The deal ID returned by open/close position' },
        },
        required: ['deal_id'],
      },
      handler: async (args) => client.getSwapStatus(args.deal_id as number),
    },

    // ── Write tools ──────────────────────────────────────────────────────

    {
      name: 'storm_open_position',
      description:
        'Open a new futures position on Storm Trade. Specify direction (long/short), pair (e.g. "BTC/USD"), leverage (2-100), and amount in nanoTON. Optionally set stop_loss_price and take_profit_price in USD. Returns a deal ID — poll storm_get_swap_status with it until confirmed. IMPORTANT: amount and margin are in nanoTON (1 TON = 1,000,000,000 nanoTON).',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['long', 'short'], description: 'Position direction' },
          pair: { type: 'string', description: 'Trading pair, e.g. "BTC/USD", "ETH/USD", "TON/USD"' },
          leverage: { type: 'number', description: 'Leverage multiplier (2–100)' },
          amount: { type: 'number', description: 'Margin amount in nanoTON' },
          deal_type: { type: 'string', enum: ['market', 'stopLimit'], description: 'Order type (default "market")' },
          stop_loss_price: { type: 'number', description: 'Stop loss price in USD (optional)' },
          take_profit_price: { type: 'number', description: 'Take profit price in USD (optional)' },
          limit_price: { type: 'number', description: 'Limit price in nanoTON for limit orders (optional)' },
          stop_trigger_price: { type: 'number', description: 'Stop trigger price in nanoTON (optional)' },
        },
        required: ['direction', 'pair', 'leverage', 'amount'],
      },
      handler: async (args) => {
        const amount = args.amount as number;
        const leverage = args.leverage as number;
        return client.openPosition({
          direction: args.direction as 'long' | 'short',
          pair: args.pair as string,
          leverage,
          amount,
          margin: amount * leverage,
          deal_type: (args.deal_type as 'market' | 'stopLimit') ?? 'market',
          stop_loss_price: (args.stop_loss_price as number) ?? 0,
          take_profit_price: (args.take_profit_price as number) ?? 0,
          limit_price: (args.limit_price as number) ?? 0,
          stop_trigger_price: (args.stop_trigger_price as number) ?? 0,
          stop_price: 0,
          entry_price: 0,
          el_price: 0,
        });
      },
    },

    {
      name: 'storm_close_position',
      description:
        'Close an existing futures position (fully or partially). Provide the deal ID and amount in nanoTON. For full close, use the full margin amount of the position. Returns status "pending" — poll storm_get_swap_status until confirmed.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Deal ID to close' },
          amount: { type: 'number', description: 'Amount to close in nanoTON (full margin for full close)' },
        },
        required: ['id', 'amount'],
      },
      handler: async (args) =>
        client.closePosition({
          id: args.id as number,
          amount: args.amount as number,
        }),
    },

    {
      name: 'storm_create_order',
      description:
        'Create a Take Profit or Stop Loss order for an existing open position. Specify the order_type ("takeProfit" or "stopLoss"), the base asset (e.g. "BTC"), direction of the position, margin and trigger price in nanoTON.',
      parameters: {
        type: 'object',
        properties: {
          order_type: { type: 'string', enum: ['takeProfit', 'stopLoss'], description: 'Order type' },
          baseAsset: { type: 'string', description: 'Base asset: "BTC", "ETH", "TON", etc.' },
          direction: { type: 'string', enum: ['long', 'short'], description: 'Direction of the position' },
          marginIn: { type: 'number', description: 'Margin in nanoTON' },
          amount: { type: 'number', description: 'Order size in nanoTON' },
          triggerPrice: { type: 'number', description: 'Trigger price in nanoTON' },
        },
        required: ['order_type', 'baseAsset', 'direction', 'marginIn', 'amount', 'triggerPrice'],
      },
      handler: async (args) =>
        client.createOrder({
          order_type: args.order_type as 'takeProfit' | 'stopLoss',
          baseAsset: args.baseAsset as string,
          direction: args.direction as 'long' | 'short',
          marginIn: args.marginIn as number,
          amount: args.amount as number,
          triggerPrice: args.triggerPrice as number,
        }),
    },

    {
      name: 'storm_wait_confirmation',
      description:
        'Wait for a deal to be confirmed on-chain. Polls status every 3 seconds until the deal reaches a terminal state (confirmed/failed/adjusted) or times out after 120 seconds. Use this after storm_open_position or storm_close_position.',
      parameters: {
        type: 'object',
        properties: {
          deal_id: { type: 'number', description: 'Deal ID to wait for' },
        },
        required: ['deal_id'],
      },
      handler: async (args) => client.waitForConfirmation(args.deal_id as number),
    },
  ];
}
