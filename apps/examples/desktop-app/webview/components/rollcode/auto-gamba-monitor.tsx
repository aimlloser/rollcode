"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Dice5, Square } from "lucide-react";
import { useAutoGamba } from "./use-auto-gamba";
import { GameIcon } from "./game-icon";
import { games } from "./game-picker";
import { PlayingCard } from "./playing-card";
import { GameHistory } from "./game-history";
import { tokenLabel } from "./game-units";
import { SLOT_SYMBOLS } from "../../../sidecar/rollcode/slots";
import type { PublicGame } from "../../../sidecar/rollcode/game-types";
import { RED_NUMBERS } from "../../../sidecar/rollcode/game-types";

export function AutoGambaMonitor() {
	const { state, error, saving, stop, setEnabled } = useAutoGamba();
	const [expanded, setExpanded] = useState(true);
	if (!state) return null;
	if (!state.enabled && !state.jobs.some((j) => j.status === "running"))
		return null;
	const running = state.jobs.filter((j) => j.status === "running");
	const job = running[0] ?? state.jobs[0];
	const game = job?.roll.game;
	const balance = job?.roll.simulatedTokens ?? job?.roll.tokens ?? 0;
	return createPortal(
		<aside className="rc-auto-monitor" aria-label="Auto Gamba live player">
			<header>
				<button
					type="button"
					className="rc-auto-heading"
					onClick={() => setExpanded(!expanded)}
					aria-expanded={expanded}
				>
					<Dice5 size={15} />
					<strong>Auto Gamba</strong>
					<span className={running.length ? "rc-auto-pulse" : ""}>
						{running.length ? "Playing" : "Watching"}
					</span>
					{expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
				</button>
				<button
					type="button"
					className="rc-auto-off"
					onClick={() => void setEnabled(false)}
					disabled={saving}
					title="Turn off Auto Gamba"
				>
					Off
				</button>
			</header>
			{expanded && (
				<div className="rc-auto-content">
					{job ? (
						<>
							<div className="rc-auto-summary">
								<span title={job.roll.sessionId}>
									{game
										? games.find((g) => g.id === game.kind)?.name
										: "Choosing a game…"}
								</span>
								<b>{tokenLabel(balance)}</b>
							</div>
							<div
								key={`${job.id}:${game?.revision ?? 0}`}
								className="rc-auto-stage"
								data-running={job.status === "running"}
							>
								{game ? (
									<AutoGamePreview game={game} />
								) : (
									<Dice5 size={44} className="rc-auto-wait" />
								)}
								<p>
									{job.status === "free"
										? "Free task!"
										: job.status === "error"
											? "Run stopped"
											: job.status === "stopped"
												? "Stopped"
												: (game?.message ?? "First game starts shortly")}
								</p>
							</div>
							<div className="rc-auto-controls">
								<span>
									{job.roll.rounds?.length
										? "Recent games below"
										: "Progress saved"}
									{running.length > 1
										? ` · ${running.length} responses queued`
										: ""}
								</span>
								{job.status === "running" && (
									<button
										type="button"
										onClick={() => void stop(job.id)}
										disabled={saving}
									>
										<Square size={10} fill="currentColor" />
										Stop this run
									</button>
								)}
							</div>
							{job.error && (
								<p className="rc-auto-error" role="alert">
									{job.error}
								</p>
							)}
							<GameHistory roll={job.roll} />
						</>
					) : (
						<p className="rc-auto-idle">
							Ready for your next response. Games start after the AI finishes.
						</p>
					)}
					{error && (
						<p className="rc-auto-error" role="alert">
							{error}
						</p>
					)}
				</div>
			)}
		</aside>,
		document.body,
	);
}

function AutoGamePreview({ game }: { game: PublicGame }) {
	if (game.kind === "slots")
		return (
			<div className="rc-auto-slot-reels">
				{game.reels.map((n, i) => (
					<img
						key={i}
						src={`/app-icons/${SLOT_SYMBOLS[n]!.id}.png`}
						alt={SLOT_SYMBOLS[n]!.label}
						style={{ animationDelay: `${i * 120}ms` }}
					/>
				))}
			</div>
		);
	if (game.kind === "blackjack")
		return (
			<div className="rc-auto-cards">
				<div>
					<small>Dealer</small>
					<div>
						{game.dealer.map((card, i) => (
							<PlayingCard key={i} value={card} />
						))}
					</div>
				</div>
				<div>
					<small>You</small>
					<div>
						{game.player.map((card, i) => (
							<PlayingCard key={i} value={card} />
						))}
					</div>
				</div>
			</div>
		);
	if (game.kind === "dice")
		return (
			<div className="rc-auto-dice">
				<GameIcon game="dice" />
				<strong>{game.value.toFixed(2)}</strong>
				<small>
					{game.direction === "over" ? "Roll over" : "Roll under"}{" "}
					{game.threshold}
				</small>
			</div>
		);
	if (game.kind === "roulette")
		return (
			<div className="rc-auto-wheel">
				<div className="rc-auto-wheel-ring" />
				<b
					style={{
						color:
							game.number === 0
								? "#8dceaa"
								: RED_NUMBERS.includes(game.number)
									? "#f18f88"
									: "#e8dfd1",
					}}
				>
					{game.number}
				</b>
			</div>
		);
	if (game.kind === "mines")
		return (
			<div className="rc-auto-mines">
				{Array.from({ length: 25 }, (_, i) => (
					<span
						key={i}
						data-gem={game.revealed.includes(i)}
						data-mine={game.mines?.includes(i)}
					>
						{game.revealed.includes(i)
							? "◆"
							: game.mines?.includes(i)
								? "✹"
								: ""}
					</span>
				))}
			</div>
		);
	return (
		<svg
			className="rc-auto-plinko"
			viewBox="0 0 200 125"
			aria-label={`Plinko slot ${game.bucket + 1}`}
		>
			{Array.from({ length: game.rows }, (_, r) =>
				Array.from({ length: r + 3 }, (_, c) => (
					<circle
						key={`${r}:${c}`}
						cx={100 + (c - (r + 2) / 2) * 16}
						cy={12 + r * 12}
						r="2"
						fill="#aaa08d"
					/>
				)),
			)}
			<polyline
				points={[
					"100,0",
					...game.path.map(
						(_, i) =>
							`${100 + (game.path.slice(0, i + 1).reduce((a, b) => a + b, 0) - (i + 1) / 2) * 16},${12 + i * 12}`,
					),
				].join(" ")}
				fill="none"
				stroke="#e2bb70"
				strokeWidth="2"
			/>
			<circle
				cx={100 + (game.bucket - game.rows / 2) * 16}
				cy={12 + game.rows * 12}
				r="5"
				fill="#ed9e69"
			/>
		</svg>
	);
}
