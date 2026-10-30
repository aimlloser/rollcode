"use client";
import { useEffect, useRef, useState } from "react";
import { tokenAmount } from "./game-units";
import { getRoundHistory } from "./game-history";
import type { Roll } from "../../../sidecar/rollcode/ledger";

type TokenChange = { id: string; tokens: number };
export function roundTokenChanges(rolls: Roll[]): TokenChange[] {
	return rolls.flatMap((roll) =>
		getRoundHistory(roll).map((round) => ({
			id: `${roll.id}:${round.id}`,
			tokens: Number((round.stakeTokens - round.resultTokens).toFixed(6)),
		})),
	);
}

/** Feedback follows unique saved rounds, never polling, opening history, or new task debits. */
export function TokenChangeBurst({
	events,
	ready = true,
}: {
	events: TokenChange[];
	ready?: boolean;
}) {
	const seen = useRef<Set<string> | null>(null);
	const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const [bursts, setBursts] = useState<TokenChange[]>([]);
	useEffect(() => {
		if (!ready) return;
		if (!seen.current) {
			seen.current = new Set(events.map((event) => event.id));
			return;
		}
		const fresh: TokenChange[] = [];
		for (const event of events) {
			if (seen.current.has(event.id)) continue;
			seen.current.add(event.id);
			if (Number.isFinite(event.tokens) && event.tokens !== 0)
				fresh.push(event);
		}
		if (!fresh.length) return;
		const shown = fresh.slice(-4);
		setBursts((previous) => [...previous, ...shown].slice(-4));
		for (const event of shown) {
			const timer = setTimeout(() => {
				setBursts((previous) =>
					previous.filter((item) => item.id !== event.id),
				);
				timers.current.delete(timer);
			}, 1400);
			timers.current.add(timer);
		}
	}, [events, ready]);
	useEffect(
		() => () => {
			for (const timer of timers.current) clearTimeout(timer);
			timers.current.clear();
		},
		[],
	);
	return (
		<span className="rc-token-changes" aria-hidden="true">
			{bursts.slice(-1).map((event) => (
				<span
					key={event.id}
					className="rc-token-change"
					data-change={event.tokens > 0 ? "win" : "loss"}
				>
					{event.tokens > 0 ? "+" : "−"}
					{tokenAmount(Math.abs(event.tokens))}
				</span>
			))}
		</span>
	);
}
