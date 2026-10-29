"use client";
import { Dice5 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { Roll } from "../../../sidecar/rollcode/ledger";
import { GamePicker, type GameId } from "./game-picker";
import { GameArena } from "./game-arena";
import { GameHistory } from "./game-history";
import type { Gamble } from "./use-response-rolls";
import { demoCredits } from "../../../sidecar/rollcode/demo-wallet";

export function ResponseGamba({
	roll,
	onGamble,
}: {
	roll: Roll;
	onGamble: Gamble;
}) {
	const [open, setOpen] = useState(false),
		[arena, setArena] = useState(false);
	const [game, setGame] = useState<GameId>("dice");
	const [saved, setSaved] = useState<Roll>();
	const [newRound, setNewRound] = useState(false);
	const [arenaKey, setArenaKey] = useState(0);
	const result =
		(roll.game?.revision ?? 0) > (saved?.game?.revision ?? 0)
			? roll
			: (saved ?? roll);
	const usageReported = roll.usageReported ?? roll.tokens > 0;
	const settled = usageReported && result.multiplier !== null;
	const adjustedTokens =
		result.simulatedTokens ?? result.tokens * (result.multiplier ?? 1);
	const costChange =
		(result.multiplier ?? 1) < 1
			? "savings"
			: (result.multiplier ?? 1) > 1
				? "extra"
				: "unchanged";
	const active = result.game?.phase === "active";
	const arenaStake = newRound
		? adjustedTokens
		: (result.activeRound?.stakeTokens ??
			result.rounds?.at(-1)?.stakeTokens ??
			roll.tokens);
	function choose(kind: GameId) {
		setGame(active ? result.game!.kind : kind);
		setNewRound(!active);
		setArenaKey((key) => key + 1);
		setOpen(false);
		setArena(true);
	}
	function viewLastGame() {
		if (!result.game) return;
		setGame(result.game.kind);
		setNewRound(false);
		setArenaKey((key) => key + 1);
		setOpen(false);
		setArena(true);
	}
	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="rc-token-trigger"
						data-cost-change={settled ? costChange : undefined}
						aria-label={`Gamba · ${usageReported ? `${roll.tokens.toLocaleString()} actual tokens${settled ? `; ${adjustedTokens.toLocaleString()} simulated tokens after game` : ""}` : "Usage unavailable"}`}
						title={
							settled
								? `Simulated cost after game. Actual API usage remains ${roll.tokens.toLocaleString()} tokens.`
								: "Gamba"
						}
					>
						{settled ? (
							<>
								<s className="rc-token-original">
									{roll.tokens.toLocaleString()}
								</s>
								<span className="rc-token-adjusted">
									{adjustedTokens.toLocaleString()} tokens
								</span>
								<span className="rc-token-sim">sim.</span>
							</>
						) : (
							<span>
								{usageReported
									? `${roll.tokens.toLocaleString()} tokens`
									: "Usage unavailable"}
							</span>
						)}
						<Dice5 size={12} />
						<span className="rc-gamba-hint" aria-hidden="true">
							Gamba
						</span>
					</button>
				</PopoverTrigger>
				<PopoverContent
					className="rc-gamba-popover"
					side="top"
					align="start"
					sideOffset={9}
				>
					<div className="rc-gamba-heading">
						<Dice5 size={16} />
						<h3>Gamba</h3>
						<span>Simulated</span>
					</div>
					<div className="rc-gamba-price">
						<span>
							{usageReported
								? `${roll.tokens.toLocaleString()} actual tokens`
								: "Token usage not reported"}
						</span>
						<b>{usageReported ? demoCredits(roll.tokens) : "—"}</b>
					</div>
					<dl className="rc-gamba-breakdown">
						<div>
							<dt>Input</dt>
							<dd>{roll.inputTokens?.toLocaleString() ?? "—"}</dd>
						</div>
						<div>
							<dt>Output</dt>
							<dd>{roll.outputTokens?.toLocaleString() ?? "—"}</dd>
						</div>
						<div>
							<dt title="Cached tokens are included in the input total">
								Cached input
							</dt>
							<dd>{roll.cacheReadTokens?.toLocaleString() ?? "—"}</dd>
						</div>
					</dl>
					{result.multiplier !== null ? (
						<output className="rc-gamba-result">
							<strong>
								{result.multiplier === 0
									? "Free task"
									: `${Number(result.multiplier.toFixed(3))}×`}
							</strong>
							<span>
								{(
									result.simulatedTokens ?? result.tokens * result.multiplier
								).toLocaleString()}{" "}
								simulated tokens
							</span>
							<span>{demoCredits(adjustedTokens)} · Demo cost</span>
						</output>
					) : null}
					{!active && usageReported && adjustedTokens > 0 && (
						<>
							<p className="rc-game-status">
								{settled
									? `Play again with ${demoCredits(adjustedTokens)}`
									: "Choose a game"}
							</p>
							<GamePicker selected={game} onSelect={choose} />
						</>
					)}
					{!active && settled && adjustedTokens <= 0 && (
						<p className="rc-game-status">
							This message is free. No tokens left to play.
						</p>
					)}
					{result.game ? (
						<Button
							type="button"
							className="rc-gamba-roll"
							onClick={viewLastGame}
						>
							{result.game.phase === "active" ? "Continue game" : "View game"}
						</Button>
					) : null}
					<GameHistory roll={result} />
					<p className="rc-gamba-note">
						Demo only · 1 credit = 1,000 tokens. Actual API charges stay the
						same.
					</p>
				</PopoverContent>
			</Popover>
			<GameArena
				key={arenaKey}
				open={arena}
				onOpenChange={setArena}
				game={game}
				roll={result}
				newRound={newRound}
				stakeTokens={arenaStake}
				onPlay={onGamble}
				onPlayAgain={choose}
				onUpdate={(updated) => {
					setSaved(updated);
					setNewRound(false);
				}}
			/>
		</>
	);
}
