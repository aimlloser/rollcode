"use client";
import type { CSSProperties } from "react";
import { tokenAmount, tokenLabel } from "./game-units";
import {
	CHIP_DENOMINATIONS,
	RED_NUMBERS,
	WHEEL,
	type PublicGame,
	type RouletteBet,
} from "../../../sidecar/wode/game-types";
type State<K extends PublicGame["kind"]> = Extract<PublicGame, { kind: K }>;
function betName(bet: string) {
	return bet.startsWith("n")
		? `Number ${bet.slice(1)}`
		: bet.startsWith("dozen")
			? `${bet.slice(-1)}${bet.endsWith("1") ? "st" : bet.endsWith("2") ? "nd" : "rd"} dozen`
			: bet === "low"
				? "1–18"
				: bet === "high"
					? "19–36"
					: bet;
}
export function RouletteBoard({
	state,
	bets,
	denomination,
	onDenomination,
	onPlace,
	onUndo,
	onClear,
	stake,
	disabled,
	busy,
}: {
	state?: State<"roulette">;
	bets: RouletteBet[];
	denomination: number;
	onDenomination: (value: number) => void;
	onPlace: (bet: string) => void;
	onUndo: () => void;
	onClear: () => void;
	stake: number;
	disabled: boolean;
	busy: boolean;
}) {
	const visibleBets = state
		? state.bets
			? state.bets.map((b) => ({
					...b,
					chips:
						state.chipUnit === "tokens" ? b.chips : (b.chips * stake) / 100,
				}))
			: [{ bet: state.bet, chips: stake }]
		: bets;
	const amount = (bet: string) =>
		visibleBets.find((b) => b.bet === bet)?.chips ?? 0;
	const total = visibleBets.reduce((sum, b) => sum + b.chips, 0);
	const remaining = Math.max(0, stake - total);
	const index = state ? WHEEL.indexOf(state.number) : 0;
	const label = (bet: string) =>
		`${betName(bet)} · ${tokenLabel(amount(bet))}${disabled ? "" : ` · click to place ${tokenLabel(denomination)}`}`;
	const marker = (bet: string) =>
		amount(bet) > 0 ? (
			<span
				className="rc-chip-marker"
				data-chip={chipColor(amount(bet))}
				aria-hidden="true"
			>
				{chipText(amount(bet))}
			</span>
		) : null;
	return (
		<div className="rc-roulette">
			<div className="rc-wheel-wrap">
				<span className="rc-wheel-pointer">▼</span>
				<svg
					viewBox="0 0 200 200"
					className={busy ? "rc-wheel-spin" : ""}
					style={
						{
							transform: `rotate(${1800 - (index * 360) / 37}deg)`,
							"--wheel-stop": `${1800 - (index * 360) / 37}deg`,
						} as CSSProperties
					}
					aria-label={
						state
							? `Winning number ${state.number}`
							: "Single-zero roulette wheel"
					}
				>
					<circle cx="100" cy="100" r="96" fill="#c39a5a" />
					{WHEEL.map((n, i) => {
						const angle = 360 / 37;
						return (
							<g key={n} transform={`rotate(${i * angle} 100 100)`}>
								<path
									d="M100 100 91.86 4.35 A96 96 0 0 1 108.14 4.35Z"
									fill={
										n === 0
											? "#38aa81"
											: RED_NUMBERS.includes(n)
												? "#dd4c67"
												: "#302a25"
									}
									stroke="#d9b677"
									strokeWidth=".35"
								/>
								<text
									x="100"
									y="18"
									textAnchor="middle"
									fill="white"
									fontSize="7"
								>
									{n}
								</text>
							</g>
						);
					})}
					<circle
						cx="100"
						cy="100"
						r="62"
						fill="#211e1b"
						stroke="#d9b677"
						strokeWidth="2"
					/>
					<circle cx="100" cy="100" r="10" fill="#e8bd75" />
					<path
						d="M100 54v92M54 100h92"
						stroke="#e8bd75"
						strokeWidth="4"
						strokeLinecap="round"
					/>
				</svg>
				{state && (
					<span
						className={`rc-roulette-orbit${busy ? " rc-ball-orbit" : ""}`}
						aria-hidden="true"
					>
						<i />
					</span>
				)}
				{state && !busy && (
					<output className="rc-wheel-result">{state.number}</output>
				)}
			</div>
			<div className="rc-roulette-grid">
				<button
					type="button"
					disabled={disabled || remaining < denomination}
					aria-pressed={amount("n0") > 0}
					aria-label={label("n0")}
					data-bet="n0"
					className="rc-zero"
					onClick={() => onPlace("n0")}
				>
					0{marker("n0")}
				</button>
				{Array.from({ length: 36 }, (_, i) => {
					const n = Math.floor(i / 3) * 3 + (3 - (i % 3));
					return (
						<button
							type="button"
							key={n}
							disabled={disabled || remaining < denomination}
							aria-pressed={amount(`n${n}`) > 0}
							aria-label={label(`n${n}`)}
							data-bet={`n${n}`}
							className={RED_NUMBERS.includes(n) ? "rc-number-red" : ""}
							onClick={() => onPlace(`n${n}`)}
						>
							{n}
							{marker(`n${n}`)}
						</button>
					);
				})}
			</div>
			<div className="rc-outside-bets">
				{[
					"dozen1",
					"dozen2",
					"dozen3",
					"low",
					"even",
					"red",
					"black",
					"odd",
					"high",
				].map((b) => (
					<button
						type="button"
						key={b}
						disabled={disabled || remaining < denomination}
						aria-pressed={amount(b) > 0}
						aria-label={label(b)}
						data-bet={b}
						onClick={() => onPlace(b)}
						className={b === "red" ? "rc-number-red" : ""}
					>
						{betName(b)}
						{marker(b)}
					</button>
				))}
			</div>
			<div className="rc-chip-controls">
				<fieldset
					className="rc-chip-denominations"
					aria-label="Chip denomination"
				>
					<legend className="sr-only">Chip value</legend>
					{CHIP_DENOMINATIONS.map((value) => (
						<button
							type="button"
							key={value}
							data-chip={value}
							aria-label={tokenLabel(value)}
							aria-pressed={denomination === value}
							disabled={disabled || value > remaining}
							title={`${tokenLabel(value)} per chip`}
							onClick={() => onDenomination(value)}
						>
							{chipText(value)}
						</button>
					))}
				</fieldset>
				<div className="rc-chip-edit">
					<button
						type="button"
						disabled={disabled || total === 0}
						onClick={onUndo}
					>
						Undo
					</button>
					<button
						type="button"
						disabled={disabled || total === 0}
						onClick={onClear}
					>
						Clear
					</button>
				</div>
			</div>
			<div className="rc-chip-summary">
				<output>
					{tokenAmount(total)} / {tokenLabel(stake)} placed
				</output>
				<span>
					{state
						? `${tokenLabel(state.returnedChips !== undefined ? state.returnedChips * (state.chipUnit === "tokens" ? 1 : stake / 100) : (state.payout ?? 0) * stake)} gross return (includes stake)`
						: `${tokenLabel(remaining)} available`}
				</span>
			</div>
			{!state && stake < 1 && (
				<p className="rc-game-status">
					Roulette needs at least 1 token. You can choose another game from the
					message.
				</p>
			)}
		</div>
	);
}

function chipColor(amount: number) {
	return amount >= 10000
		? 10000
		: amount >= 1000
			? 1000
			: amount >= 100
				? 100
				: amount >= 10
					? 10
					: 1;
}

function chipText(value: number) {
	return value >= 1000
		? `${Number((value / 1000).toFixed(1))}K`
		: tokenAmount(value);
}
