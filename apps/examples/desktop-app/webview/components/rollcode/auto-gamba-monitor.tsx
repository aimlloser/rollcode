"use client";
import { useEffect, useState } from "react";
import { ChevronDown, Dice5, History, Square } from "lucide-react";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
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
	const { state, error, saving, stop } = useAutoGamba();
	const job = state?.jobs.find((j) => j.status === "running") ?? state?.jobs[0];
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [visible, setVisible] = useState(false);
	const [manualOpen, setManualOpen] = useState(false);
	// Bind to the actual message badge. Radix follows scrolling, resizes and edge collisions.
	useEffect(() => {
		if (!state?.enabled || !job?.id) {
			setAnchor(null);
			return;
		}
		const findAnchor = () => {
			const badge =
				Array.from(
					document.querySelectorAll<HTMLElement>(
						".rc-token-trigger[data-roll-id]",
					),
				).find((el) => el.dataset.rollId === job?.id) ?? null;
			setAnchor((previous) => (previous === badge ? previous : badge));
			setManualOpen(badge?.dataset.state === "open");
		};
		findAnchor();
		const observer = new MutationObserver(findAnchor);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-state", "data-roll-id"],
		});
		return () => observer.disconnect();
	}, [job?.id, state?.enabled]);
	useEffect(() => {
		setVisible(false);
		if (!anchor) return;
		const observer = new IntersectionObserver(([entry]) =>
			setVisible(!!entry?.isIntersecting),
		);
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [anchor]);
	if (!state?.enabled || !job || !anchor) return null;
	const game = job.roll.game;
	const balance = job.roll.simulatedTokens ?? job.roll.tokens;
	return (
		<Popover open={visible && !manualOpen}>
			<PopoverAnchor virtualRef={{ current: anchor }} />
			<PopoverContent
				className="rc-auto-monitor"
				side="top"
				align="start"
				sideOffset={6}
				collisionPadding={12}
				aria-label="Auto Gamba live game"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onCloseAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => e.preventDefault()}
			>
				<div className="rc-auto-summary">
					<span>
						{game ? <GameIcon game={game.kind} /> : <Dice5 size={16} />}
						{game
							? games.find((g) => g.id === game.kind)?.name
							: "Choosing game"}
					</span>
					<b
						aria-live="polite"
						title={job.status === "free" ? "Free task" : undefined}
					>
						{tokenLabel(balance)}
					</b>
				</div>
				<div
					key={job.id + ":" + String(game?.revision ?? 0)}
					className="rc-auto-stage"
					data-running={job.status === "running"}
				>
					{game ? (
						<AutoGamePreview game={game} />
					) : (
						<Dice5 size={36} className="rc-auto-wait" />
					)}
				</div>
				<details className="rc-auto-history">
					<summary>
						<History size={12} />
						History
						<ChevronDown size={12} />
					</summary>
					<GameHistory roll={job.roll} />
					{!job.roll.rounds?.length && (
						<p className="rc-auto-idle">No completed games yet.</p>
					)}
					{job.status === "running" && (
						<button
							type="button"
							className="rc-auto-stop"
							disabled={saving}
							onClick={() => void stop(job.id)}
						>
							<Square size={10} fill="currentColor" />
							Stop this run
						</button>
					)}
				</details>
				{(job.error || error) && (
					<p className="rc-auto-error" role="alert">
						{job.error || error}
					</p>
				)}
			</PopoverContent>
		</Popover>
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
