# @tractioneye/storm-sdk

AI agent SDK for futures trading on Storm Trade DEX via TractionEye.

## Install

```bash
npm install @tractioneye/storm-sdk
```

## Quick start

```typescript
import { StormClient, createStormTools } from '@tractioneye/storm-sdk';

// Initialize client with agent token from strategy settings
const client = await StormClient.create({
  agentToken: 'your-agent-token-here',
});

// Get tools for your agent framework (OpenClaw, LangChain, etc.)
const tools = createStormTools(client);

// Or use the client directly
const positions = await client.getOpenDeals();

// Open a long position on BTC/USD with 3x leverage, 0.1 TON margin
const deal = await client.openPosition({
  direction: 'long',
  pair: 'BTC/USD',
  leverage: 3,
  amount: 100_000_000, // 0.1 TON in nanoTON
  margin: 300_000_000, // amount * leverage
  deal_type: 'market',
  stop_loss_price: 80000,
  take_profit_price: 100000,
});

// Wait for on-chain confirmation
const status = await client.waitForConfirmation(deal.id);
console.log('Position opened:', status.status);
```

## Tools

The SDK provides 10 tools compatible with OpenClaw, LangChain, and OpenAI function calling:

| Tool | Type | Description |
|------|------|-------------|
| `storm_get_open_positions` | read | List open positions |
| `storm_get_all_deals` | read | All deals including closed |
| `storm_get_aggregated_positions` | read | Portfolio grouped by token |
| `storm_get_orders` | read | TP/SL order history |
| `storm_get_available_markets` | read | Supported trading pairs |
| `storm_get_swap_status` | read | Check deal confirmation status |
| `storm_open_position` | write | Open long/short with leverage |
| `storm_close_position` | write | Close position (full/partial) |
| `storm_create_order` | write | Set Take Profit / Stop Loss |
| `storm_wait_confirmation` | write | Wait for on-chain settlement |

## Agent skill

See [`skills/storm-trading.md`](skills/storm-trading.md) for the complete agent skill file with rules, lifecycle, and unit reference.

## Units

| Field | Unit | Example |
|-------|------|---------|
| amount, margin | nanoTON | 100000000 = 0.1 TON |
| entry_price, stop_loss_price, take_profit_price | USD | 87150.5 |
| leverage | multiplier | 3.0 = 3x |
| triggerPrice | nanoTON | 100000000000 |

1 TON = 1,000,000,000 nanoTON
