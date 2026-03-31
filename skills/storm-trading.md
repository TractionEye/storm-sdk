# Storm Trade Futures Agent

I manage leveraged futures positions on Storm Trade DEX via TractionEye. I can open/close long and short positions, set Take Profit and Stop Loss orders, and monitor deal status.

## Available Tools

### Read tools (safe, no side effects)

| Tool | When to use |
|------|-------------|
| `storm_get_open_positions` | Check current open positions before making any trading decisions |
| `storm_get_all_deals` | Review full trade history (open + closed) to analyze past performance |
| `storm_get_aggregated_positions` | Get portfolio overview — total exposure per asset |
| `storm_get_orders` | Check existing TP/SL orders to avoid duplicates |
| `storm_get_available_markets` | Verify a trading pair exists before opening a position |
| `storm_get_swap_status` | Check if a pending deal has been confirmed on-chain |

### Write tools (execute trades, require confirmation)

| Tool | When to use |
|------|-------------|
| `storm_open_position` | Open a new long or short position with leverage |
| `storm_close_position` | Close an existing position (full or partial) |
| `storm_create_order` | Set Take Profit or Stop Loss on an existing position |
| `storm_wait_confirmation` | Wait for on-chain confirmation after open/close |

## Units

- **amount, margin, marginIn**: nanoTON (1 TON = 1,000,000,000 nanoTON)
- **entry_price, stop_loss_price, take_profit_price**: USD
- **triggerPrice**: nanoTON
- **leverage**: multiplier (2.0 = 2x, up to 100x)
- **profit_or_loss**: nanoTON

## Deal lifecycle

1. Call `storm_open_position` → returns `{ id: 742 }`
2. Call `storm_wait_confirmation(742)` or poll `storm_get_swap_status(742)` → wait for `confirmed`
3. Position is now open and trading on Storm
4. Optionally set TP/SL via `storm_create_order`
5. To close: `storm_close_position({ id: 742, amount: <margin> })`
6. Poll again until confirmed

## Rules

1. **Always check positions first.** Before opening, call `storm_get_open_positions` to understand current exposure.
2. **Always verify the pair.** Call `storm_get_available_markets` if unsure about a pair name.
3. **Always wait for confirmation.** After open/close, call `storm_wait_confirmation` before making further decisions.
4. **Never open opposite positions on the same pair.** Close the existing position first.
5. **Respect leverage limits.** Range is 2–100x. Higher leverage = higher liquidation risk.
6. **Set TP/SL on every position.** Use `storm_create_order` after opening to manage risk.

## Supported Markets

| Pair | Settlement | Type |
|------|-----------|------|
| BTC/USD | TON | coinm |
| ETH/USD | TON | coinm |
| TON/USD | TON | coinm |
| NOT/USD | NOT | coinm |
| TRUMP/USD | TON | coinm |
| BTC/USDT | USDT | base |
| ETH/USDT | USDT | base |
| TON/USDT | USDT | base |

## Error codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid parameters or keys not configured |
| 404 | Strategy or deal not found |
| 409 | Conflict (no open position to close) |
| 500 | Internal error |
