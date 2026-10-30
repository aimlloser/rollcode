"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/chat-schema";
import { desktopClient } from "@/lib/desktop-client";
import type { Roll } from "../../../sidecar/wode/ledger";
import type { GameRequest } from "../../../sidecar/wode/game-types";
export type Gamble = (id: string, request?: GameRequest) => Promise<Roll>;
export type { Roll } from "../../../sidecar/wode/ledger";

/** Match immutable runtime identities, never approximate by timestamp or response text. */
export function matchResponseRolls(
	messages: ChatMessage[],
	rolls: Roll[],
	streamingId?: string | null,
) {
	const matched = new Map<string, Roll>();
	for (const roll of rolls) {
		const ids = new Set(roll.messageIds ?? []);
		const answer = messages.findLast(
			(message) =>
				message.role === "assistant" &&
				message.sessionId === roll.sessionId &&
				message.id !== streamingId &&
				message.content.trim() &&
				((roll.runId && message.meta?.rollRunId === roll.runId) ||
					(message.meta?.sourceMessageId &&
						ids.has(message.meta.sourceMessageId))),
		);
		if (answer) matched.set(answer.id, roll);
	}
	return matched;
}

export function useResponseRolls(
	sessionId: string | null,
	messages: ChatMessage[],
	streamingId?: string | null,
) {
	const [rolls, setRolls] = useState<Roll[]>([]);
	const refresh = useCallback(async () => {
		if (!sessionId) return;
		try {
			const result = await desktopClient.invoke<Roll[]>("wode_list");
			if (Array.isArray(result))
				setRolls(result.filter((roll) => roll.sessionId === sessionId));
		} catch {
			/* The normal response remains readable when accounting is unavailable. */
		}
	}, [sessionId]);
	useEffect(() => {
		setRolls([]);
		void refresh();
		const stop = desktopClient.subscribe?.(
			"wode_roll",
			() => void refresh(),
		);
		const reconnect = desktopClient.subscribeTransportState?.(
			() => void refresh(),
		);
		const interval = setInterval(() => void refresh(), 15000);
		return () => {
			stop?.();
			reconnect?.();
			clearInterval(interval);
		};
	}, [refresh]);
	const gamble = useCallback(async (id: string, request?: GameRequest) => {
		if (request?.action === "start") {
			let supported = false;
			try {
				const capabilities = await desktopClient.invoke<{
					rouletteTokenChips?: boolean;
					repeatGames?: boolean;
					payoutVersion?: number;
				}>("wode_capabilities");
				supported =
					capabilities?.repeatGames === true &&
					capabilities.payoutVersion === 8 &&
					(request.game !== "roulette" ||
						capabilities.rouletteTokenChips === true);
			} catch {
				/* Older backends must not silently substitute a default red bet. */
			}
			if (!supported)
				throw new Error(
					"The running backend is out of date. Restart WODE or your local backend to load the wallet, slot machine, and current payout rules. No game was started.",
				);
		}
		const result = await desktopClient.invoke<Roll>(
			request ? "wode_play" : "wode_gamble",
			{ id, request },
		);
		if (!result || (!request && result.multiplier === null) || result.id !== id)
			throw new Error(
				"The roll could not be confirmed. Try again to retrieve its saved result.",
			);
		setRolls((previous) =>
			previous.map((roll) => (roll.id === result.id ? result : roll)),
		);
		window.dispatchEvent(new Event("wode-ledger-updated"));
		return result;
	}, []);
	const byMessage = useMemo(
		() => matchResponseRolls(messages, rolls, streamingId),
		[messages, rolls, streamingId],
	);
	return { byMessage, gamble };
}
