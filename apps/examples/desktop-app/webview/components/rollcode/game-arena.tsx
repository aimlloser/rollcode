"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Bomb, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	cardScore,
	CHIP_DENOMINATIONS,
	minesCostMultiplier,
	costMultiplier,
	plinkoPayouts,
	legacyPlinkoPayouts,
	type GameId,
	type GameRequest,
	type PublicGame,
	type RouletteBet,
} from "../../../sidecar/rollcode/game-types";
import type { Roll } from "../../../sidecar/rollcode/ledger";
import type { Gamble } from "./use-response-rolls";
import { GameIcon } from "./game-icon";
import { GameInfo } from "./game-info";
import { PlayingCard } from "./playing-card";
import { games } from "./game-picker";
import { RouletteBoard } from "./roulette-board";
import { SlotsBoard } from "./slots-board";
import { tokenAmount, tokenLabel } from "./game-units";

export function GameArena({
	open,
	onOpenChange,
	game,
	roll,
	onPlay,
	onUpdate,
	newRound = false,
	stakeTokens,
	onPlayAgain,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	game: GameId;
	roll: Roll;
	onPlay: Gamble;
	onUpdate: (roll: Roll) => void;
	newRound?: boolean;
	stakeTokens?: number;
	onPlayAgain?: (game: GameId) => void;
}) {
	const [threshold, setThreshold] = useState(50);
	const [direction, setDirection] = useState<"over" | "under">("over");
	const [rows, setRows] = useState(12),
		[risk, setRisk] = useState("medium");
	const [count, setCount] = useState(3);
	const [placements, setPlacements] = useState<RouletteBet[]>([]);
	const [denomination, setDenomination] = useState(100);
	const [busy, setBusy] = useState(false),
		[error, setError] = useState("");
	const [animating, setAnimating] = useState(false);
	const pending = useRef<GameRequest | null>(null);
	const locked = useRef(false);
	const alive = useRef(true);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	const state = newRound ? undefined : roll.game;
	const stake =
		stakeTokens ??
		roll.activeRound?.stakeTokens ??
		roll.rounds?.at(-1)?.stakeTokens ??
		roll.tokens;
	const kind = state?.kind ?? game;
	const started = !!state || (!newRound && roll.multiplier !== null);
	const active = state?.phase === "active";
	useEffect(() => {
		if (pending.current && state && state.revision > pending.current.revision) {
			pending.current = null;
			setError("");
		}
	}, [state]);
	const placedChips = placements.reduce((sum, p) => sum + p.chips, 0);
	const remainingTokens = Math.max(0, stake - placedChips);
	const affordableChip = (available: number) =>
		denomination <= available
			? denomination
			: [...CHIP_DENOMINATIONS].reverse().find((value) => value <= available);
	const selectedChip = affordableChip(remainingTokens) ?? CHIP_DENOMINATIONS[0];
	useEffect(() => {
		if (kind === "roulette" && !started && selectedChip !== denomination) {
			setDenomination(selectedChip);
		}
	}, [kind, started, selectedChip, denomination]);
	const rouletteBets = Object.entries(
		placements.reduce<Record<string, number>>((totals, p) => {
			totals[p.bet] = (totals[p.bet] ?? 0) + p.chips;
			return totals;
		}, {}),
	).map(([bet, chips]) => ({ bet, chips }));
	function placeChip(bet: string) {
		if (started || locked.current || error) return;
		setPlacements((previous) => {
			const available = stake - previous.reduce((sum, p) => sum + p.chips, 0);
			const chips = affordableChip(available);
			return chips === undefined ? previous : [...previous, { bet, chips }];
		});
	}
	const name = games.find((g) => g.id === kind)!.name;
	async function act(action: GameRequest["action"], index?: number) {
		if (locked.current) return;
		locked.current = true;
		setBusy(true);
		setError("");
		const request = pending.current ?? {
			requestId: crypto.randomUUID(),
			revision: roll.game?.revision ?? 0,
			game: kind,
			action,
			index,
			config: { threshold, direction, rows, risk, count, bets: rouletteBets },
		};
		pending.current = request;
		try {
			const result = await onPlay(roll.id, request);
			if (!alive.current) return;
			setAnimating(true);
			onUpdate(result);
			pending.current = null;
			const duration =
				result.game?.kind === "slots"
					? 2900
					: result.game?.kind === "plinko"
						? 850 + result.game.rows * 75
						: result.game?.kind === "roulette"
							? 2700
							: result.game?.kind === "blackjack"
								? 600 +
									Math.max(
										result.game.player.length,
										result.game.dealer.length,
									) *
										130
								: result.game?.kind === "dice"
									? 950
									: 450;
			if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
				await new Promise((resolve) => setTimeout(resolve, duration));
		} catch (cause) {
			if (alive.current)
				setError(
					cause instanceof Error
						? cause.message
						: "Action could not be confirmed. Retry to recover it.",
				);
		} finally {
			locked.current = false;
			if (alive.current) {
				setBusy(false);
				setAnimating(false);
			}
		}
	}
	const target = state?.kind === "dice" ? state.threshold : threshold;
	const rollDirection = state?.kind === "dice" ? state.direction : direction;
	const chance = rollDirection === "over" ? 100 - target : target;
	const lastRound = roll.rounds?.at(-1);
	const roundCost =
		lastRound?.game?.revision === state?.revision && lastRound
			? lastRound.multiplier
			: (state?.costFactor ??
				(state?.phase === "complete" && stake > 0
					? (roll.simulatedTokens ?? stake) / stake
					: 1));
	const mineCost =
		state?.kind === "mines" && state.phase === "complete"
			? roundCost
			: state?.kind === "mines"
				? (state.costFactor ??
					minesCostMultiplier(state.count, state.revealed.length))
				: minesCostMultiplier(count, 0);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={`rc-arena rc-arena-minimal${kind === "roulette" ? " rc-arena-roulette" : ""}`}
			>
				<header className="rc-arena-header">
					<GameIcon game={kind} />
					<DialogTitle>{name}</DialogTitle>
					<DialogDescription className="sr-only">
						Play with this task’s tokens.
					</DialogDescription>
					<div className="rc-game-stake">
						<span>Stake</span>
						<strong title={`${stake.toLocaleString()} tokens`}>
							{tokenAmount(stake)}
						</strong>
						<span>tokens</span>
					</div>
					<GameInfo kind={kind} chance={chance} />
				</header>
				<div className="rc-game-options">
					{kind === "dice" && (
						<>
							<label>
								Roll direction
								<select
									disabled={started || busy || !!error}
									value={state?.kind === "dice" ? state.direction : direction}
									onChange={(e) =>
										setDirection(e.target.value as "over" | "under")
									}
								>
									<option value="over">Roll over (≥)</option>
									<option value="under">Roll under (&lt;)</option>
								</select>
							</label>
							<label>
								Target
								<input
									type="number"
									min={2}
									max={98}
									step={1}
									disabled={started || busy || !!error}
									value={state?.kind === "dice" ? state.threshold : threshold}
									onChange={(e) =>
										setThreshold(
											Math.max(2, Math.min(98, Number(e.target.value))),
										)
									}
								/>
							</label>
							<div className="rc-game-facts">
								<span>
									Win chance<b>{chance}%</b>
								</span>
								<span>
									Cost on win
									<b>{Number(costMultiplier(99 / chance).toFixed(4))}×</b>
								</span>
							</div>
						</>
					)}
					{kind === "plinko" && (
						<>
							<label>
								Risk
								<select
									disabled={started || busy || !!error}
									value={state?.kind === "plinko" ? state.risk : risk}
									onChange={(e) => setRisk(e.target.value)}
								>
									{["low", "medium", "high"].map((r) => (
										<option key={r} value={r}>
											{r}
										</option>
									))}
								</select>
							</label>
							<label>
								Rows
								<select
									disabled={started || busy || !!error}
									value={state?.kind === "plinko" ? state.rows : rows}
									onChange={(e) => setRows(Number(e.target.value))}
								>
									{[8, 12, 16].map((r) => (
										<option key={r}>{r}</option>
									))}
								</select>
							</label>
						</>
					)}
					{kind === "mines" && (
						<>
							<label>
								Mines
								<select
									disabled={started || busy || !!error}
									value={state?.kind === "mines" ? state.count : count}
									onChange={(e) => setCount(Number(e.target.value))}
								>
									{Array.from({ length: 10 }, (_, i) => (
										<option key={i} value={i + 1}>
											{i + 1}
										</option>
									))}
								</select>
							</label>
							<div className="rc-game-facts">
								<span>
									Gems found
									<b>{state?.kind === "mines" ? state.revealed.length : 0}</b>
								</span>
								<span>
									Cost multiplier
									<b>{Number(mineCost.toFixed(6))}×</b>
								</span>
								<span>
									Cash-out cost
									<b>{tokenLabel(stake * mineCost)}</b>
								</span>
							</div>
						</>
					)}
				</div>
				<div className="rc-arena-body">
					<section
						className={`rc-game-board rc-board-${kind}${animating ? " rc-board-busy" : ""}`}
						aria-label={`${name} game board`}
					>
						{kind === "slots" && (
							<SlotsBoard
								state={state?.kind === "slots" ? state : undefined}
								busy={busy}
								animating={animating}
								disabled={
									started ||
									busy ||
									!!error ||
									roll.usageReported === false ||
									stake <= 0
								}
								onSpin={() => void act("start")}
							/>
						)}
						{kind === "blackjack" && (
							<BlackjackBoard
								state={state?.kind === "blackjack" ? state : undefined}
								busy={animating}
							/>
						)}
						{kind === "dice" && (
							<DiceBoard
								busy={animating}
								state={state?.kind === "dice" ? state : undefined}
								threshold={threshold}
								direction={direction}
								onThreshold={setThreshold}
								disabled={started || busy || !!error}
							/>
						)}
						{kind === "plinko" && (
							<PlinkoBoard
								settledMultiplier={roundCost}
								state={state?.kind === "plinko" ? state : undefined}
								rows={rows}
								risk={risk}
								busy={animating}
							/>
						)}
						{kind === "mines" && (
							<div className="rc-mines-grid">
								{Array.from({ length: 25 }, (_, i) => {
									const g = state?.kind === "mines" ? state : undefined;
									const gem = g?.revealed.includes(i),
										mine = g?.mines?.includes(i);
									return (
										<button
											type="button"
											key={i}
											aria-label={`Tile ${i + 1}${gem ? ", gem" : mine ? ", mine" : ""}`}
											disabled={!active || busy || !!error || gem}
											className={`${gem ? "rc-gem " : ""}${mine ? "rc-mine " : ""}${g?.hit === i ? "rc-hit" : ""}`}
											onClick={() => void act("pick", i)}
										>
											{gem ? (
												<svg viewBox="0 0 40 40" aria-hidden="true">
													<path
														d="m10 6 20 0 8 11-18 20L2 17 10 6Z"
														fill="#62ed9a"
														stroke="#b7ffd1"
														strokeWidth="1.5"
													/>
													<path
														d="M2 17h36M10 6l4 11 6 20 6-20 4-11M14 17l6-11 6 11"
														stroke="#24ad6c"
														strokeWidth="1.2"
													/>
												</svg>
											) : mine ? (
												<Bomb fill="#ed7584" color="#ffbac4" />
											) : (
												<span />
											)}
										</button>
									);
								})}
							</div>
						)}
						{kind === "roulette" && (
							<RouletteBoard
								state={state?.kind === "roulette" ? state : undefined}
								bets={rouletteBets}
								onPlace={placeChip}
								denomination={selectedChip}
								onDenomination={setDenomination}
								onUndo={() => setPlacements((p) => p.slice(0, -1))}
								onClear={() => setPlacements([])}
								stake={stake}
								disabled={started || busy || !!error}
								busy={animating}
							/>
						)}
						<output className="rc-board-status">
							{busy
								? kind === "blackjack"
									? "Dealing…"
									: kind === "roulette"
										? "Spinning…"
										: kind === "plinko"
											? "Ball in play…"
											: "Playing…"
								: (state?.message ??
									(kind === "roulette"
										? "Choose a number or an outside bet"
										: kind === "mines"
											? "Start a game, then uncover gems"
											: "Ready when you are"))}
						</output>
					</section>
				</div>
				<div className="rc-game-action-bar">
					{!started && (
						<button
							type="button"
							className="rc-play"
							disabled={
								busy ||
								!!error ||
								roll.usageReported === false ||
								(kind === "roulette" && placedChips === 0) ||
								stake <= 0
							}
							onClick={() => void act("start")}
						>
							{busy ? <Loader2 className="animate-spin" size={16} /> : null}
							{kind === "slots"
								? "Spin reels"
								: kind === "blackjack"
									? "Deal cards"
									: kind === "plinko"
										? "Drop ball"
										: kind === "roulette"
											? "Spin wheel"
											: kind === "mines"
												? "Start game"
												: "Roll dice"}
						</button>
					)}
					{active && kind === "blackjack" && (
						<div className="rc-hand-actions">
							<button
								type="button"
								disabled={busy || !!error}
								onClick={() => void act("hit")}
							>
								Hit
							</button>
							<button
								type="button"
								disabled={busy || !!error}
								onClick={() => void act("stand")}
							>
								Stand
							</button>
						</div>
					)}
					{active && kind === "mines" && (
						<button
							type="button"
							className="rc-play"
							disabled={busy || !!error}
							onClick={() => void act("cashout")}
						>
							Cash out
						</button>
					)}
					{error && (
						<div role="alert" className="rc-game-error">
							{error}
							<button
								type="button"
								disabled={busy}
								onClick={() => void act(pending.current?.action ?? "start")}
							>
								Retry action
							</button>
						</div>
					)}
					{state?.phase === "complete" && !busy && (
						<output
							className={`rc-game-settled${(roll.multiplier ?? 1) > 1 ? " rc-cost-loss" : ""}`}
						>
							<span>Saved task cost</span>
							<strong>
								{roll.multiplier === 0
									? "Free task"
									: tokenLabel(roll.simulatedTokens ?? stake * roundCost)}
							</strong>
							<small>{Number(roundCost.toFixed(6))}× this game’s stake</small>
						</output>
					)}
					{state?.phase === "complete" && !busy && onPlayAgain && (
						<button
							type="button"
							className="rc-play"
							disabled={
								(roll.simulatedTokens ?? 0) <= 0 ||
								(kind === "roulette" && (roll.simulatedTokens ?? 0) < 1)
							}
							title={
								(roll.simulatedTokens ?? 0) <= 0
									? "No adjusted tokens left to play"
									: kind === "roulette" && (roll.simulatedTokens ?? 0) < 1
										? "Roulette needs at least 1 token"
										: `Play ${name} again with your latest adjusted tokens`
							}
							onClick={() => onPlayAgain(kind)}
						>
							Play again
						</button>
					)}
				</div>
				<footer className="rc-arena-footer">
					<span>Token stakes · API charges unchanged.</span>
					<span>{active ? "Progress saved" : "Every game is saved"}</span>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
type State<K extends PublicGame["kind"]> = Extract<PublicGame, { kind: K }>;
function BlackjackBoard({
	state,
	busy,
}: {
	state?: State<"blackjack">;
	busy: boolean;
}) {
	return (
		<div className="rc-blackjack-table">
			<div className="rc-card-hand">
				<span>
					DEALER{" "}
					{state && !busy && !state.dealer.includes(null)
						? `· ${cardScore(state.dealer as number[])}`
						: ""}
				</span>
				<div>
					{(state?.dealer ?? [null, null]).map((c, i) => (
						<PlayingCard
							key={`${i}-${c}`}
							value={c}
							delay={busy ? i * 130 : 0}
						/>
					))}
				</div>
			</div>
			<div className="rc-card-hand">
				<span>
					YOUR HAND {state && !busy ? `· ${cardScore(state.player)}` : ""}
				</span>
				<div className={busy ? "rc-dealing" : ""}>
					{(state?.player ?? [null, null]).map((c, i) => (
						<PlayingCard
							key={`${i}-${c}`}
							value={c}
							delay={busy ? i * 130 + 120 : 0}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
function DiceBoard({
	busy,
	state,
	threshold,
	direction,
	onThreshold,
	disabled,
}: {
	busy: boolean;
	state?: State<"dice">;
	threshold: number;
	direction: string;
	onThreshold: (n: number) => void;
	disabled: boolean;
}) {
	const target = state?.threshold ?? threshold,
		dir = state?.direction ?? direction;
	return (
		<div className="rc-dice-board">
			<div className="rc-dice-ticks">
				{[0, 25, 50, 75, 100].map((n) => (
					<span key={n}>{n}</span>
				))}
			</div>
			<div
				className="rc-dice-track"
				style={{
					background: `linear-gradient(to right, ${dir === "over" ? "#b96373" : "#77b58d"} ${target}%, ${dir === "over" ? "#77b58d" : "#b96373"} ${target}%)`,
				}}
			>
				{state && (
					<div
						className={`rc-dice-value ${state.payout && !busy ? "rc-dice-win" : ""}`}
						style={
							{
								left: `${Math.max(5, Math.min(95, state.value))}%`,
								"--roll-stop": `${Math.max(5, Math.min(95, state.value))}%`,
							} as CSSProperties
						}
					>
						{busy ? "•••" : state.value.toFixed(2)}
					</div>
				)}
				<input
					type="range"
					aria-label="Dice target"
					min={2}
					max={98}
					step={1}
					value={target}
					disabled={disabled}
					onChange={(e) => onThreshold(Number(e.target.value))}
				/>
			</div>
			<div className="rc-dice-caption">
				{dir === "over" ? "Roll at or above" : "Roll below"} {target.toFixed(2)}{" "}
				to win
			</div>
		</div>
	);
}
function PlinkoBoard({
	state,
	rows,
	risk,
	busy,
	settledMultiplier,
}: {
	state?: State<"plinko">;
	rows: number;
	risk: string;
	busy: boolean;
	settledMultiplier: number;
}) {
	const n = state?.rows ?? rows,
		rawSlots = state
			? (state.payouts ?? legacyPlinkoPayouts(n, state.risk))
			: plinkoPayouts(n, risk);
	const payouts =
		state && state.costFactor === undefined
			? rawSlots.map((value, index) =>
					index === state.bucket ? settledMultiplier : costMultiplier(value),
				)
			: rawSlots;
	const slotY = 42 + n * 18;
	const pitch = 36;
	const boardWidth = (n + 2) * pitch + 40;
	const center = boardWidth / 2;
	const slotCenter = (index: number) => center + (index - n / 2) * pitch;
	let right = 0;
	const points = [
		`${center},16`,
		...(state?.path ?? []).map((step, i) => {
			right += step;
			return `${center + (right - (i + 1) / 2) * pitch},${35 + i * 18}`;
		}),
	];
	if (state) points.push(`${slotCenter(state.bucket)},${slotY - 7}`);
	let path = `M${center} 16`;
	for (let i = 1; i < points.length; i++) {
		const [previousX, previousY] = points[i - 1]!.split(",").map(Number);
		const [x, y] = points[i]!.split(",").map(Number);
		path += ` Q ${previousX} ${previousY! - 3} ${x} ${y}`;
	}
	return (
		<div
			className="rc-plinko"
			style={{ "--drop-duration": `${650 + n * 75}ms` } as CSSProperties}
		>
			<svg
				viewBox={`0 0 ${boardWidth} ${slotY + 38}`}
				aria-label="Plinko peg board"
			>
				<g fill="#d2e4ed">
					{Array.from({ length: n }, (_, r) =>
						Array.from({ length: r + 3 }, (_, c) => (
							<circle
								key={`${r}:${c}`}
								cx={center + (c - (r + 2) / 2) * pitch}
								cy={35 + r * 18}
								r="2.5"
							/>
						)),
					)}
				</g>
				{state && (
					<>
						<path
							className="rc-ball-trail"
							d={path}
							stroke="#ffb64d"
							strokeWidth="2"
							fill="none"
							opacity={busy ? 0 : 0.16}
						/>
						<circle
							key={state.revision}
							className={busy ? "rc-plinko-ball" : ""}
							cx="0"
							cy="0"
							r="6"
							fill="#ffb545"
							stroke="#ffe0a0"
							strokeWidth="2"
							style={
								{
									offsetPath: `path('${path}')`,
									offsetDistance: "100%",
								} as CSSProperties
							}
						/>
					</>
				)}
				<g className="rc-plinko-payouts">
					{payouts.map((p, i) => (
						<g
							key={i}
							className={`rc-plinko-slot${state?.bucket === i && !busy ? " rc-slot-landed" : ""}`}
							aria-label={`Slot ${i + 1}: ${p === 0 ? "Free, zero adjusted token cost" : `${p} times token cost`}`}
						>
							<rect
								x={slotCenter(i) - 16}
								y={slotY}
								width="32"
								height="30"
								rx="4"
								fill={p < 1 ? "#6cb58a" : p === 1 ? "#d1ae65" : "#b76c78"}
								stroke={
									state?.bucket === i && !busy ? "#fff1bf" : "transparent"
								}
								strokeWidth="1.3"
							/>
							<text
								x={slotCenter(i)}
								y={slotY + (p === 0 ? 13 : 19)}
								textAnchor="middle"
								fontSize={String(p).length >= 5 ? 8.5 : 11}
								fontWeight="650"
								fill="#271f17"
							>
								{Number(p.toFixed(3))}×
							</text>
							{p === 0 && (
								<text
									x={slotCenter(i)}
									y={slotY + 24}
									textAnchor="middle"
									fontSize="7"
									fontWeight="650"
									fill="#271f17"
								>
									FREE
								</text>
							)}
						</g>
					))}
				</g>
			</svg>
		</div>
	);
}
