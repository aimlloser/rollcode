// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ResponseGamba } from "./response-gamba";
import { matchResponseRolls, type Roll } from "./use-response-rolls";
import type { ChatMessage } from "@/lib/chat-schema";
import {
	startGame,
	advanceGame,
	type PrivateGame,
} from "../../../sidecar/rollcode/game-engine";
import {
	costMultiplier,
	type GameRequest,
} from "../../../sidecar/rollcode/game-types";
const pending: Roll = {
	id: "task:run",
	runId: "run",
	sessionId: "task",
	messageIds: ["raw-answer"],
	completedAt: "2026-10-25T12:00:00Z",
	tokens: 1250,
	inputTokens: 1000,
	outputTokens: 250,
	cacheReadTokens: 200,
	usageReported: true,
	baseCost: 2,
	simulatedCost: 2,
	multiplier: null,
	acknowledged: false,
};
let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.useRealTimers();
});
test("matches exact response identity, excluding other sessions and streaming messages", () => {
	const make = (id: string, sessionId = "task"): ChatMessage => ({
		id,
		sessionId,
		role: "assistant",
		createdAt: 1,
		content: "Same answer",
		meta: { sourceMessageId: "raw-answer" },
	});
	expect([
		...matchResponseRolls(
			[make("old", "other"), make("answer"), make("streaming")],
			[pending],
			"streaming",
		).keys(),
	]).toEqual(["answer"]);
	expect(
		matchResponseRolls(
			[{ ...make("live"), meta: { rollRunId: "run" } }],
			[pending],
		).get("live")?.id,
	).toBe(pending.id);
});
async function setup(failFirst = false) {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	window.matchMedia = vi.fn().mockReturnValue({ matches: true });
	let state: PrivateGame | undefined;
	const gamble = vi.fn(async (_id: string, request?: GameRequest) => {
		if (!request) throw Error("Game request required");
		if (failFirst) {
			failFirst = false;
			throw Error("Connection interrupted");
		}
		state = state
			? advanceGame(state, request)
			: startGame(
					request,
					(max) => (max === 10000 ? 7500 : max - 1),
					pending.tokens,
				);
		const multiplier =
			state.public.payout === null
				? null
				: Number(costMultiplier(state.public.payout).toFixed(6));
		return {
			...pending,
			game: structuredClone(state.public),
			multiplier,
			simulatedTokens: pending.tokens * (multiplier ?? 1),
			simulatedCost: pending.baseCost! * (multiplier ?? 1),
		};
	});
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	await act(async () =>
		root.render(<ResponseGamba roll={pending} onGamble={gamble} />),
	);
	return { gamble, tokens: container.querySelector("button")! };
}
const button = (text: string) =>
	Array.from(document.querySelectorAll("button")).find(
		(b) => b.textContent === text,
	)!;
async function click(target: HTMLElement) {
	expect(target).toBeTruthy();
	await act(async () => target.click());
}
async function escape() {
	await act(async () =>
		document.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		),
	);
}
test("choosing a game opens without playing; Dice settles once and saved results reopen", async () => {
	const { gamble, tokens } = await setup();
	expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
	await click(tokens);
	expect(
		document
			.querySelector('[aria-label="Choose a game"]')
			?.querySelectorAll("button"),
	).toHaveLength(5);
	await click(button("Dice"));
	expect(document.querySelector('[aria-label="Dice game board"]')).toBeTruthy();
	expect(gamble).not.toHaveBeenCalled();
	await click(button("Roll dice"));
	expect(gamble).toHaveBeenCalledOnce();
	expect(gamble.mock.calls[0]?.[1]).toMatchObject({
		game: "dice",
		action: "start",
		revision: 0,
	});
	expect(document.body.textContent).toContain("Saved task cost");
	expect(button("Roll dice")).toBeUndefined();
	await escape();
	await click(tokens);
	expect(document.body.textContent).toContain("25 simulated tokens");
	await click(button("View game"));
	expect(document.body.textContent).toContain("Winning roll");
	expect(gamble).toHaveBeenCalledOnce();
});
test.each([
	"Blackjack",
	"Plinko",
	"Mines",
	"Roulette",
])("%s has a working board and explicit start", async (name) => {
	const { gamble, tokens } = await setup();
	await click(tokens);
	await click(button(name));
	expect(gamble).not.toHaveBeenCalled();
	expect(
		document.querySelector(`[aria-label="${name} game board"]`),
	).toBeTruthy();
	if (name === "Roulette") {
		expect(
			(document.querySelector(".rc-play") as HTMLButtonElement).disabled,
		).toBe(true);
		await click(
			document.querySelector('[aria-label="100 tokens"]') as HTMLButtonElement,
		);
		await click(
			document.querySelector('[data-bet="red"]') as HTMLButtonElement,
		);
	}
	await click(document.querySelector(".rc-play") as HTMLButtonElement);
	expect(gamble).toHaveBeenCalledOnce();
	expect(gamble.mock.calls[0]?.[1]?.game).toBe(name.toLowerCase());
	if (name === "Mines") {
		await click(
			document.querySelector('[aria-label="Tile 4"]') as HTMLButtonElement,
		);
		expect(document.querySelector('[aria-label="Tile 4, gem"]')).toBeTruthy();
		await click(button("Cash out"));
		expect(gamble).toHaveBeenCalledTimes(3);
		expect(document.body.textContent).toContain("Saved task cost");
	} else if (name === "Blackjack") {
		await click(button("Stand"));
		expect(gamble).toHaveBeenCalledTimes(2);
		expect(document.body.textContent).toContain("Saved task cost");
	}
});

test("a failed transport retries the identical request instead of starting a new wager", async () => {
	const { gamble, tokens } = await setup(true);
	await click(tokens);
	await click(button("Mines"));
	await click(button("Start game"));
	expect(document.body.textContent).toContain("Connection interrupted");
	await click(button("Retry action"));
	expect(gamble).toHaveBeenCalledTimes(2);
	expect(gamble.mock.calls[1]?.[1]).toEqual(gamble.mock.calls[0]?.[1]);
	expect(button("Cash out")).toBeTruthy();
});

test("animated play waits for the reveal before showing the saved cost and never repeats the wager", async () => {
	const { gamble, tokens } = await setup();
	await click(tokens);
	await click(button("Plinko"));
	window.matchMedia = vi.fn().mockReturnValue({ matches: false });
	vi.useFakeTimers();
	await click(button("Drop ball"));
	expect(document.body.textContent).toContain("Ball in play…");
	expect(document.body.textContent).not.toContain("Saved task cost");
	expect(gamble).toHaveBeenCalledOnce();
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2200);
	});
	expect(document.body.textContent).toContain("Saved task cost");
	expect(document.querySelector(".rc-slot-landed")).toBeTruthy();
	expect(gamble).toHaveBeenCalledOnce();
});

test("rules are on demand, the stake stays visible, and opening info never starts a game", async () => {
	const { gamble, tokens } = await setup();
	await click(tokens);
	await click(button("Blackjack"));
	expect(document.querySelector(".rc-game-stake")?.textContent).toContain(
		"1,250",
	);
	expect(document.querySelector("aside")).toBeNull();
	expect(document.body.textContent).not.toContain("max(0, 2 − game payout)");
	await click(
		document.querySelector(
			'[aria-label="Game rules and calculations"]',
		) as HTMLButtonElement,
	);
	expect(document.body.textContent).toContain(
		"max(0, 2 − game payout) × stake",
	);
	expect(document.body.textContent).toContain("dealer stands on all 17s");
	expect(gamble).not.toHaveBeenCalled();
	await escape();
	await click(button("Deal cards"));
	expect(document.querySelector(".rc-game-stake")?.textContent).toContain(
		"1,250",
	);
	expect(gamble).toHaveBeenCalledOnce();
});

test("Roulette supports chip denominations, repeated placements, undo and clear before one saved spin", async () => {
	const { gamble, tokens } = await setup();
	await click(tokens);
	await click(button("Roulette"));
	const destination = (bet: string) =>
		document.querySelector(`[data-bet="${bet}"]`) as HTMLButtonElement;
	await click(
		document.querySelector('[aria-label="10 tokens"]') as HTMLButtonElement,
	);
	await click(destination("n7"));
	await click(destination("n7"));
	await click(destination("red"));
	expect(document.body.textContent).toContain("30 / 1,250 tokens placed");
	expect(destination("n7").textContent).toContain("20");
	await click(button("Undo"));
	expect(document.body.textContent).toContain("20 / 1,250 tokens placed");
	await click(button("Clear"));
	expect(document.body.textContent).toContain("0 / 1,250 tokens placed");
	expect(gamble).not.toHaveBeenCalled();
	await click(destination("n7"));
	await click(destination("red"));
	await click(button("Spin wheel"));
	expect(gamble.mock.calls[0]?.[1]?.config?.bets).toEqual([
		{ bet: "n7", chips: 10 },
		{ bet: "red", chips: 10 },
	]);
	expect(gamble).toHaveBeenCalledOnce();
	expect(destination("n7").disabled).toBe(true);
	expect(document.querySelector(".rc-token-original")?.textContent).toBe(
		"1,250",
	);
	expect(
		document
			.querySelector(".rc-token-trigger")
			?.getAttribute("data-cost-change"),
	).toBe("unchanged");
});

test.each([
	[0, "savings"],
	[0.5, "savings"],
	[1, "unchanged"],
	[2, "extra"],
] as const)("settled token badge preserves actual usage and shows %s× simulated cost", async (multiplier, change) => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	await act(async () =>
		root.render(
			<ResponseGamba
				roll={{
					...pending,
					multiplier,
					simulatedTokens: pending.tokens * multiplier,
				}}
				onGamble={vi.fn()}
			/>,
		),
	);
	const trigger = container.querySelector(".rc-token-trigger")!;
	expect(trigger.querySelector("s")?.textContent).toBe("1,250");
	expect(trigger.querySelector(".rc-token-adjusted")?.textContent).toBe(
		`${(1250 * multiplier).toLocaleString()} tokens`,
	);
	expect(trigger.getAttribute("data-cost-change")).toBe(change);
	expect(trigger.getAttribute("aria-label")).toContain("1,250 actual tokens");
	expect(trigger.textContent).toContain("sim.");
});
