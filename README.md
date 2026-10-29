<p align="center">
  <img src="apps/examples/desktop-app/webview/public/app-icons/lucky-dice.png" width="96" alt="ROLLCODE pixel dice" />
</p>

<h1 align="center">ROLLCODE</h1>
<p align="center"><strong>Tokens are expensive. Feeling lucky? 🎲</strong></p>
<p align="center">A local AI coding agent with a twist: play games to win back your simulated task costs.</p>

ROLLCODE is a Windows desktop fork of **[Cline](https://github.com/cline/cline)**. It builds on Cline’s coding agent, model integrations, tools, approvals, terminal, and workspaces, with a redesigned interface and a local demo credit system.

**All credits, winnings, and savings are simulated. Your model provider’s actual API charges stay unchanged.**

## What’s inside

- **A coding agent that already works:** Cline’s existing agent and tools, with support for its model providers and your own API keys.
- **A quieter desktop interface:** warm dark surfaces, readable chat typography, and selectable gambling-themed pixel art app icons.
- **Opt-in games:** click the tokens beside a completed response to open Gamba. Games never pop up automatically.
- **A demo wallet:** 10,000 starting credits, a visible credit balance and token counter, and a refill option.
- **Usage and history:** actual tokens, adjusted demo costs, per-response game history, and JSON export.
- **Local storage:** balances and game outcomes persist on your device. No ROLLCODE hosted backend is required; inference uses your configured model provider.

## Demo credits

**1 demo credit = 1,000 tokens.** The starting 10,000 credits represent 10 million demo tokens.

A completed response deducts its reported input + output tokens from the demo wallet. Cached input is already included in input usage. For example, a 23,536-token response costs **23.536 demo credits**.

Playing a game changes that response’s simulated cost, and the wallet refunds or deducts the difference. If you stake a response costing 10 credits in Blackjack:

| Result | New response cost | Wallet adjustment |
| --- | --- | --- |
| Win | 0 credits | Refund 10 credits |
| Tie | 10 credits | No change |
| Lose | 20 credits | Deduct another 10 credits |

You can play again using the response’s latest simulated cost. Results compound, and each game stays in that response’s history. Once a response is free, there is no remaining cost to stake.

The sidebar shows your demo credit balance and its token equivalent. **Usage → Reset to 10,000** refills the wallet without deleting history. Existing saved responses count toward spending. A negative demo balance is shown explicitly and does not block actual API usage.

Credits have **no cash value**. Dollar estimates are displayed separately and depend on the model provider’s pricing.

## Games

All displayed multipliers apply directly to the staked demo cost: **0× is free, 0.5× halves the cost, and 2× doubles it.**

| Game | How it works |
| --- | --- |
| **Blackjack** | Hit or stand. Any win makes the stake free; a loss costs 2×; a tie stays at 1×. Dealer stands on all 17s. |
| **Dice** | Choose a target and roll over or under. The win chance determines the winning cost multiplier; a miss costs 2×. |
| **Plinko** | Choose risk and rows. The outermost slots are free; costs rise toward the center. |
| **Mines** | Start at 2× and reveal safe gems to reduce the multiplier. Cash out before hitting a mine. |
| **Roulette** | Stack demo credit chips across numbers and outside bets. Winning red/black bets refund the full amount placed; losing bets add that amount. Unplaced credits stay unchanged. |
| **Slots** | Drag the lever down and release. Three Jackpot icons make the stake free, other triples cost 0.25×, pairs cost 0.5×, and no match costs 2×. |

Rules, calculations, and slot probabilities are available through the **ⓘ** button in each game. Saved historical outcomes retain their original results.

## Run from source

Requirements:

- **Bun 1.4.2+** and **Node.js 22+**. Use Bun for dependencies and scripts.
- A supported model provider API key or supported provider login.
- For the native Windows app: Rust stable with the MSVC toolchain, Visual Studio C++ Build Tools with the Windows SDK, and WebView2 Runtime.

```powershell
# The ROLLCODE implementation currently lives on this branch.
git clone --branch codex/rollcode https://github.com/aimlloser/rollcode.git
cd rollcode

bun install
bun run build:sdk

# Native Windows desktop app
bun run rollcode:desktop
```

For development without the native shell:

```powershell
bun run rollcode
```

Open `http://localhost:3125`. The local backend runs on `127.0.0.1:3126`. Optional upstream cloud and account features still use their respective services; they are not required for local use with your own API key.

SDK dependencies resolve through compiled files. Rebuild with `bun run build:sdk` after changing SDK source. Restart the backend after backend changes.

## Build a Windows installer

```powershell
bun run rollcode:build
```

The packaging script copies installers into `apps/examples/desktop-app/dist/desktop/`. Packaged users do not need Bun or Node.js installed.

For additional development notes and accounting details, see [ROLLCODE.md](ROLLCODE.md). ROLLCODE is currently a development MVP.

## Persistence

The demo ledger lives at `%USERPROFILE%\.rollcode\ledger.sqlite`. Model credentials, chats, and provider settings use Cline’s existing local storage.

Game logic is modular under [`sidecar/rollcode`](apps/examples/desktop-app/sidecar/rollcode). The backend uses cryptographically secure randomness. SQLite transactions save game state, outcomes, and request receipts together, so retrying an action does not draw again or charge twice.

The wallet derives spending from saved response costs rather than replaying debit events. Keep the database and its WAL/SHM files together when backing up a running app, or quit before copying it.

## Built on Cline

ROLLCODE is **forked from [cline/cline](https://github.com/cline/cline)**, including the [desktop implementation](https://github.com/cline/cline/tree/main/apps/examples/desktop-app). The underlying coding agent is reused rather than rebuilt.

The upstream **[Apache License 2.0](LICENSE)**, copyright notices, and **[NOTICE](NOTICE)** are retained. ROLLCODE is an independent modification and is not endorsed by Cline. Bundled fonts retain their respective license notices.

Game interfaces use original code and artwork inspired by casino games. ROLLCODE is not affiliated with Stake and does not include Stake branding or assets.
