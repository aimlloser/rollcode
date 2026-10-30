# WODE

**Tokens are expensive. Feeling lucky? 🎲**

WODE is a local Windows desktop fork of [Cline](https://github.com/cline/cline),
using the actual upstream Tauri shell, Next.js UI, bundled CLI/Hub, coding agent,
model providers, tools, approvals, terminal, workspaces, and settings. The full
upstream source is retained. There is no WODE server or payment service.

## Run

Prerequisites: Windows 10/11, Bun 1.4.2 or newer, Node 22+, and a model provider
API key (or an existing supported Cline login). For the native shell/build, install
Rust stable with the MSVC target, Microsoft Visual Studio C++ Build Tools with the
Windows SDK, and Microsoft Edge WebView2 Runtime.

From the repository root:

On this checkout, `./Start-WODE.ps1` uses the workspace-local Bun/Rust tools
prepared during development. Use `./Start-WODE.ps1 web` for the local browser
UI, `./Start-WODE.ps1 build` for the installer, or `./Start-WODE.ps1 test`.

```powershell
bun install
bun run build:sdk
bun run wode            # local backend + UI at http://localhost:3125
bun run wode:desktop    # native Windows desktop development app
bun run wode:build      # standalone Windows installer
```

The packaged app includes the runtime; end users do not need Bun or Node.
Windows installers are copied into `apps/examples/desktop-app/dist/desktop/`.
Choose **your own API key** during onboarding to use direct model APIs without a
Cline account. Keys, provider settings and tasks use Cline's existing local
storage. Upstream optional account, cloud, MCP, and connector features remain;
they are not required to use the local agent. WODE's upstream Cline desktop
auto-update endpoint is removed to prevent replacing this fork with Cline.

The workspace-local Bun downloaded during development can be added to this
PowerShell session if Bun is not on PATH:

```powershell
$env:PATH = "$PWD\.tools\bun-windows-x64;$env:PATH"
```

## Credits and games

Completed root-agent tasks record real reported input + output tokens and the normal estimated cost without drawing a result or opening anything. Cached input is already included in input, so it is not counted twice. Click the tokens beside a response timestamp to open **Gamba**, choose a game, and explicitly start it. See **Local games** below for rules and payout mapping. Open **Usage**, above **Settings**, for totals, history and export. Existing outcomes keep their original values.

**Credits have no monetary value, cannot be redeemed, and never change actual API charges.** The local wallet starts with 10,000 credits, with 1 credit = 1,000 tokens (10 million starting tokens). Each completed response deducts its token count; games refund or add the change in its adjusted cost. The wallet derives charges from saved outcomes, so repeated events and retries never debit twice. Existing responses count toward spending. A negative balance is displayed explicitly and never blocks actual API usage. The sidebar shows credits and their token equivalent. Dollar estimates are separate and depend on provider pricing. This is not invoice reconciliation. Failed/interrupted tasks and teammate completions are excluded. Cline's original usage displays remain available.
## Persistence and boundaries

- Modular backend: `apps/examples/desktop-app/sidecar/wode/ledger.ts`.
- Node `crypto.randomInt(max)` gives unbiased cryptographic draws.
- SQLite WAL, FULL synchronous writes, an immediate transaction and a primary
  key on the session/runtime run ID serialize concurrent consumers (legacy
  events use their durable Hub event ID). Completion captures normal usage;
  only explicit game actions draw or advance a game. Duplicate events and game
  requests reuse the saved entry without drawing again.
- Ledger: `%USERPROFILE%\.wode\ledger.sqlite`. Back up the database together
  with its WAL/SHM files while running, or quit before copying it. An optional
  `WODE_LEDGER_PATH` overrides the path for testing. Existing installations reuse
  `%USERPROFILE%\.rollcode\ledger.sqlite` when no WODE ledger exists, and the
  previous `ROLLCODE_LEDGER_PATH` override remains supported for compatibility.
- Sessions are registered before sending a prompt; unrelated CLI sessions are
  excluded. Errors, cancellation, iteration limits and teammate completions do
  not roll. Refreshing the UI and switching sessions cannot reroll.
- On startup the Hub observer requests replay from sequence zero; saved event
  IDs deduplicate retained completions. Recovery of a completion never received
  by the backend depends on the upstream Hub event log retention. Deleting the
  ledger or the Hub event log defeats recovery; this is a local credit system, not
  an immutable or tamper-resistant financial record.
- A disk-write failure surfaces an error without changing agent execution.
  Correct disk access and restart to replay retained completion events.
- Reduced-motion settings skip the dice animation. All dashboard actions work
  by keyboard through the existing accessible dialog primitives.

## Tests

```powershell
cd apps/examples/desktop-app
bun run test:wode
bun run typecheck
bun run build:web
bun x vitest run sidecar/chat-session.test.ts sidecar/server.test.ts --config vitest.config.ts
```

The ledger suite tests all 100 ticket allocations, missing/invalid prices,
normal cost before opt-in, duplicate delivery, two database connections,
reopen/restart recovery and failed-draw rollback. UI tests check that completion
opens nothing automatically, the compact popover rolls only on explicit action,
and reopening shows the same outcome. Runtime tests cover exact response identity
and exclusion of previous turns. The SDK Hub client tests cover replay cursors.

## Attribution

Based on Cline, Apache License 2.0. The original [LICENSE](LICENSE), source notices
and [NOTICE](NOTICE) are included. WODE modifications cover desktop branding,
the adjusted-credit ledger/dashboard, completion metadata and replay cursor
initialization. WODE is independent and is not endorsed by Cline.


## Local games

The game room uses original artwork and code, inspired by the supplied casino UI references. It does not use Stake branding, assets, source code or exact proprietary paytables, and is not affiliated with Stake.

Each completed root-agent message can play multiple games. The first stake starts at reported input + output tokens; every subsequent stake is the latest adjusted token cost. Outcomes compound on that balance. An active Blackjack or Mines game must finish before starting another game; closing never cancels or redraws it. Previous games remain in the message history, including legacy rolls. A free message with zero adjusted tokens has nothing left to stake.

All displayed multipliers are direct token-cost multipliers: **new adjusted tokens = staked adjusted tokens × displayed cost multiplier**. 1.4× increases tokens by 40%; 0.5× halves them; 1× is unchanged. Plinko applies its slot value directly. Mines starts at 2× and decreases after each safe gem; cash-out applies that value, while a mine costs 2×. Dice and Blackjack show their resulting cost factors. Roulette applies the cost factor of each placement independently and keeps unplaced tokens unchanged. Saved historical outcomes are never recalculated. Actual API charges stay unchanged.

- **Blackjack:** single shuffled 52-card deck; hit and stand; dealer stands on soft and hard 17. Any win, including natural blackjack, makes the adjusted stake free (0× cost). A push costs 1× and a loss costs 2×. No insurance, split, surrender or double.
- **Dice:** integer targets from 2 to 98. A uniform cryptographic draw produces 0.00–99.99. Over wins at or above the target; under wins strictly below. Payout on a win is 99 divided by the win-chance percentage. At target 50 the chance is 50% and the payout is 1.98×.
- **Plinko:** 8, 12 or 16 rows, with low/medium/high risk. Each row independently draws left/right with equal chance; the number of right turns selects the bucket. Symmetric payout tables peak at the center (2× low, 2.5× medium, 3× high) and taper toward the edges. The slots are rendered in the same SVG coordinate system as the pegs and ball path; each slot center is exactly between the corresponding last-row pegs. Tables are defined in `sidecar/wode/game-types.ts` and saved with each new round. The animation follows the persisted path; physics do not select the result.
- **Mines:** 5×5 board with 1–10 mines. The board is fixed on start. The cost multiplier starts at 2×, then decreases to 2 × the probability of surviving the current number of safe selections, rounded to six decimals. Cash-out applies that multiplier to the round stake. A mine costs 2×; finding every gem automatically cashes out. Cashing out before any picks costs 2×.
- **Roulette:** European single-zero wheel. Chips represent 1, 10, 100, 1,000 and 10,000 tokens, displayed as 1, 10, 100, 1K and 10K. Games use tokens; the wallet converts at 1 credit per 1,000 tokens. Place and stack across numbers and outside bets, undo or clear before spinning. When the selected chip becomes unaffordable, the picker switches to the highest affordable denomination. A winning red/black placement saves the full amount placed; losing placements add that amount. Winning numbers apply a 1/36× cost factor and winning dozens 1/3×. Other winning outside bets apply 0.5×. Zero loses outside bets. Unplaced tokens stay unchanged. All placements settle in one saved spin; subsequent games use the updated response cost.
- **Slots:** three independent cryptographic draws across four equally likely pixel-art icons. Three Jackpot icons cost 0× (1/64 chance); other triples cost 0.25× (3/64); exactly one pair costs 0.5× (36/64); all different costs 2× (24/64). Drag the lever down and release or use the keyboard-accessible Spin button. The reels reveal a committed result, with reduced-motion support.


The backend owns all random draws (`node:crypto.randomInt`), hidden cards/boards, decisions and settlement. SQLite transactions persist private state, public progress, request receipts and final costs atomically. A unique request ID makes retries return current saved state without replaying a decision. Expected revisions reject stale actions from other windows. Public ledger responses never include a hidden deck or an active Mines board. This is a local credit system; users with direct filesystem access can modify their own database.

Run all ledger and engine tests with `bun test sidecar/wode` from the desktop app directory. Existing UI test sources cover explicit play, Mines picks/cash-out, Blackjack stand and saved results. Recent game and wallet behavior needs validation before a release. Unknown model prices remain separate from token-based play.



After settlement, the message badge strikes through actual token usage and shows adjusted tokens beside it: green below normal cost, red above it, neutral if unchanged. The adj. label and accessible description distinguish this from actual API consumption.


Repeat games use monotonic revisions and per-request receipts: a fresh start at the current revision creates a new round, while retries return saved state. Each completed round stores its game, timestamps, stake, multiplier, and resulting tokens atomically with the message balance. The Gamba popup shows all rounds in a compact scrollable history. Original API token usage is never changed.



## Auto Gamba

Settings → General exposes an off-by-default Auto Gamba toggle. Only newly inserted, completed root-agent responses with reported positive tokens are queued while it is enabled. Existing history and duplicate completion events do not create new runs. The sidecar advances one persisted decision per active response every 0.8 seconds; each response progresses independently without waiting for another run, using all six games and the latest response stake. Blackjack hits below 17 and otherwise stands; Mines makes random unrevealed picks and may cash out after three gems; Roulette chooses red or black and places the available whole tokens. Fractional stakes below one token use another game.

The next request is committed before play and reused after interruption. The existing ledger saves the move, hidden state and receipt atomically; the queue then conditionally advances that request. Concurrent workers or restarts cannot reroll a committed action. Manual actions are rejected while an automatic run owns the response. Stop disables future moves, leaving any active hand recoverable for manual play. Turning the setting off stops every queued run; re-enabling applies to future responses. Each response has its own token-anchored mini player, with a visible Cancel button that stops only its own run. The players show public state only and honor reduced motion. Auto Gamba stops on a zero-cost result, its saved percentage-reduction target, explicit stop, or an accounting error; it never silently retries a failed move with a fresh draw. No round limit is imposed, so costs can rise during a run.

Auto Gamba stop rules persist alongside the toggle. All or nothing targets zero tokens. Percent wins accepts 1–100 and stops when the completed response cost is at most original tokens × (1 − percentage / 100), rounded to six token decimals. Each job captures its mode and percentage at enqueue; changing preferences does not change active jobs. Existing jobs migrate to All or nothing. In Mines, automatic play cashes out once its current multiplier can meet the saved target. A percentage target produces a completed `won` status; free outcomes still use `free`.
