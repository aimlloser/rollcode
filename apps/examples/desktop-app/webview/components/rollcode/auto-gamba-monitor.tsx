"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Dice5, History, Square, X } from "lucide-react";
import { useAutoGamba } from "./use-auto-gamba";
import { GameIcon } from "./game-icon";
import { games } from "./game-picker";
import { PlayingCard } from "./playing-card";
import { GameHistory } from "./game-history";
import { tokenLabel } from "./game-units";
import { TokenChangeBurst, roundTokenChanges } from "./token-change-burst";
import { SLOT_SYMBOLS } from "../../../sidecar/rollcode/slots";
import type { AutoGambaSnapshot } from "../../../sidecar/rollcode/auto-gamba";
import type { PublicGame } from "../../../sidecar/rollcode/game-types";
import { RED_NUMBERS } from "../../../sidecar/rollcode/game-types";

export function AutoGambaMonitor({ visible = true }: { visible?: boolean }) {
	const { state, error, saving, stop } = useAutoGamba();
	const [tracked, setTracked] = useState<Set<string>>(() => new Set());
	const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
	useEffect(() => {
		if (!state?.enabled) {
			setTracked((previous) => (previous.size ? new Set() : previous));
			return;
		}
		setTracked((previous) => {
			const running = state.jobs.filter((job) => job.status === "running");
			const additions = running.length
				? running
				: previous.size
					? []
					: state.jobs.slice(0, 1);
			let next = previous;
			for (const job of additions) {
				if (!next.has(job.id)) {
					if (next === previous) next = new Set(previous);
					next.add(job.id);
				}
			}
			return next;
		});
	}, [state]);
	if (!state?.enabled || !visible) return null;
	const jobs = state.jobs.filter(
		(job) =>
			!dismissed.has(job.id) &&
			(job.status === "running" || tracked.has(job.id)),
	);
	return (
		<>
			{jobs.map((job) => (
				<AutoGambaPlayer
					key={job.id}
					job={job}
					error={error}
					saving={saving}
					stop={stop}
					onDismiss={() =>
						setDismissed((previous) => new Set(previous).add(job.id))
					}
				/>
			))}
		</>
	);
}

function AutoGambaPlayer({
	job,
	error,
	saving,
	stop,
	onDismiss,
}: {
	job: AutoGambaSnapshot["jobs"][number];
	error: string;
	saving: boolean;
	stop: (id: string) => Promise<void>;
	onDismiss: () => void;
}) {
	const [host, setHost] = useState<HTMLElement | null>(null);
	const [inset, setInset] = useState(0);
	useEffect(() => {
		const findHost = () => {
			const target =
				Array.from(
					document.querySelectorAll<HTMLElement>(
						".rc-auto-player-mount[data-roll-id]",
					),
				).find((el) => el.dataset.rollId === job.id) ?? null;
			setHost((previous) => (previous === target ? previous : target));
		};
		findHost();
		const observer = new MutationObserver(findHost);
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [job.id]);
	useEffect(() => {
		if (!host) return;
		const badge = Array.from(
			document.querySelectorAll<HTMLElement>(".rc-token-trigger[data-roll-id]"),
		).find((el) => el.dataset.rollId === job.id);
		const align = () => {
			if (!badge) return;
			const panelWidth = Math.min(280, window.innerWidth - 24);
			setInset(
				Math.max(
					0,
					Math.min(
						badge.getBoundingClientRect().left -
							host.getBoundingClientRect().left,
						host.clientWidth - panelWidth,
					),
				),
			);
		};
		const observer = new ResizeObserver(align);
		observer.observe(host);
		if (badge) observer.observe(badge);
		window.addEventListener("resize", align);
		align();
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", align);
		};
	}, [host, job.id]);
	if (!host) return null;
	const game = job.roll.game;
	const balance = job.roll.simulatedTokens ?? job.roll.tokens;
	return createPortal(
		<section
			className="rc-auto-monitor rc-auto-inline"
			style={{ marginInlineStart: inset }}
			aria-label="Auto Gamba live game"
			onKeyDown={(event) => {
				if (event.key === "Escape" && job.status !== "running") onDismiss();
			}}
		>
			<div className="rc-auto-summary">
				<span>
					{game ? <GameIcon game={game.kind} /> : <Dice5 size={16} />}
					{game ? games.find((g) => g.id === game.kind)?.name : "Choosing game"}
				</span>
				<b
					className="rc-auto-token-value"
					aria-live="polite"
					title={
						job.status === "free"
							? "Free task"
							: job.status === "won"
								? `${job.targetPercent}% reduction target reached`
								: `Target: ${tokenLabel(job.targetTokens)}`
					}
				>
					{tokenLabel(balance)}
					<TokenChangeBurst events={roundTokenChanges([job.roll])} below />
				</b>
				{job.status !== "running" && (
					<button
						type="button"
						className="rc-auto-close"
						aria-label="Close completed Auto Gamba player"
						onClick={() => onDismiss()}
					>
						<X size={13} />
					</button>
				)}
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
			<div className="rc-auto-footer">
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
				</details>
				{job.status === "running" && (
					<button
						type="button"
						className="rc-auto-cancel"
						disabled={saving}
						onClick={() => void stop(job.id)}
						aria-label="Cancel this Auto Gamba run"
					>
						<Square size={10} fill="currentColor" />
						Cancel
					</button>
				)}
			</div>
			{(job.error || error) && (
				<p className="rc-auto-error" role="alert">
					{job.error || error}
				</p>
			)}
		</section>,
		host,
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
						style={{ animationDelay: `${i * 60}ms` }}
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
