import { expect, test } from "bun:test";
import {
	advanceGame,
	startGame,
	validateRequest,
	type PrivateGame,
} from "./game-engine";
import {
	cardScore,
	costMultiplier,
	plinkoPayouts,
	type GameId,
	type GameRequest,
} from "./game-types";

const start = (
	game: GameId,
	config: Record<string, unknown> = {},
): GameRequest => ({
	game,
	config,
	action: "start",
	requestId: "test",
	revision: 0,
});
test("Dice resolves exact hundredth boundaries and configured odds", () => {
	const g = start("dice", { threshold: 50, direction: "over" });
	expect(startGame(g, () => 4999).public.payout).toBe(0);
	expect(startGame(g, () => 5000).public.payout).toBe(1.98);
	expect(
		startGame(start("dice", { threshold: 50, direction: "under" }), () => 4999)
			.public.payout,
	).toBe(1.98);
	expect(
		startGame(start("dice", { threshold: 50, direction: "under" }), () => 5000)
			.public.payout,
	).toBe(0);
	for (const threshold of [0, 99, NaN, 2.5])
		expect(() => startGame(start("dice", { threshold }))).toThrow();
});
test("Roulette uses a single zero and settles straight, dozen and outside bets", () => {
	for (const bet of ["red", "black", "odd", "even", "low", "high", "dozen1"])
		expect(startGame(start("roulette", { bet }), () => 0).public.payout).toBe(
			0,
		);
	expect(
		startGame(start("roulette", { bet: "n0" }), () => 0).public.payout,
	).toBe(36);
	expect(
		startGame(start("roulette", { bet: "red" }), () => 32).public.payout,
	).toBe(2);
	expect(
		startGame(start("roulette", { bet: "black" }), () => 32).public.payout,
	).toBe(0);
	expect(
		startGame(start("roulette", { bet: "dozen2" }), () => 24).public.payout,
	).toBe(3);
	expect(
		startGame(start("roulette", { bet: "dozen2" }), () => 25).public.payout,
	).toBe(0);
	expect(() => startGame(start("roulette", { bet: "n37" }))).toThrow();
});
test("Plinko paths resolve their actual bucket in all supported configurations", () => {
	for (const rows of [8, 12, 16])
		for (const risk of ["low", "medium", "high"]) {
			let i = 0;
			const state = startGame(
				start("plinko", { rows, risk }),
				() => i++ % 2,
			).public;
			if (state.kind !== "plinko") throw Error("Wrong game");
			expect(state.path.length).toBe(rows);
			expect(state.bucket).toBe(rows / 2);
			const payouts = plinkoPayouts(rows, risk);
			expect(payouts.length).toBe(rows + 1);
			expect(payouts).toEqual([...payouts].reverse());
			expect(state.payout).toBe(payouts[rows / 2]!);
		}
});
test("Mines hides board until settlement, rejects repeated picks, and cashes out real progress", () => {
	const state = startGame(start("mines", { count: 3 }), (max) => max - 1);
	expect(state.public).not.toHaveProperty("mines");
	expect(state.secret).toEqual([0, 1, 2]);
	const pick = (index: number): GameRequest => ({
		...start("mines"),
		action: "pick",
		index,
	});
	advanceGame(state, pick(3));
	expect(state.public.phase).toBe("active");
	expect(() => advanceGame(state, pick(3))).toThrow("already revealed");
	advanceGame(state, { ...start("mines"), action: "cashout" });
	expect(state.public.payout).toBeCloseTo(1.125, 3);
	expect(state.public.phase).toBe("complete");
	expect(() => advanceGame(state, pick(4))).toThrow();
	const lost = startGame(start("mines"), (max) => max - 1);
	advanceGame(lost, pick(0));
	expect(lost.public.payout).toBe(0);
	const cancel = startGame(start("mines"));
	advanceGame(cancel, { ...start("mines"), action: "cashout" });
	expect(cancel.public.payout).toBe(1);
});
test("Blackjack handles aces, natural payout, pushes, busts and dealer soft 17", () => {
	expect(cardScore([0, 13, 9])).toBe(12);
	const hand = (
		player: number[],
		dealer: number[],
		deck: number[] = [],
	): PrivateGame => ({
		public: {
			kind: "blackjack",
			phase: "active",
			revision: 1,
			payout: null,
			message: "",
			player,
			dealer: [dealer[0]!, null],
		},
		secret: [...dealer, ...deck],
	});
	const stand: GameRequest = { ...start("blackjack"), action: "stand" };
	const natural = hand([0, 9], [8, 7]);
	advanceGame(natural, stand);
	expect(natural.public.payout).toBe(2.5);
	const push = hand([0, 9], [13, 22]);
	advanceGame(push, stand);
	expect(push.public.payout).toBe(1);
	const soft17 = hand([9, 8], [0, 5], [9]);
	advanceGame(soft17, stand);
	expect(soft17.public.payout).toBe(2);
	expect(
		soft17.public.kind === "blackjack" && soft17.public.dealer,
	).toHaveLength(2);
	const bust = hand([9, 8], [5, 6], [4]);
	advanceGame(bust, { ...stand, action: "hit" });
	expect(bust.public.payout).toBe(0);
	const dealerDraw = hand([9, 7], [5, 6], [9]);
	advanceGame(dealerDraw, stand);
	expect(dealerDraw.public.payout).toBe(2);
});
test("requests and settlement bounds are validated", () => {
	for (const input of [
		null,
		{},
		{ ...start("dice"), revision: -1 },
		{ ...start("dice"), game: "unknown" },
		{ ...start("dice"), requestId: "" },
	])
		expect(() => validateRequest(input)).toThrow();
	expect(costMultiplier(0)).toBe(2);
	expect(costMultiplier(1)).toBe(1);
	expect(costMultiplier(2)).toBe(0);
	expect(costMultiplier(500)).toBe(0);
});

test("Roulette combines chips on multiple destinations and protects unplaced stake", () => {
	const bets = [
		{ bet: "red", chips: 25 },
		{ bet: "n1", chips: 10 },
		{ bet: "dozen1", chips: 10 },
	];
	const winning = startGame(start("roulette", { bets }), () => 1).public;
	expect(winning.payout).toBe(4.95);
	if (winning.kind !== "roulette") throw Error("Wrong game");
	expect(winning.totalChips).toBe(45);
	expect(winning.returnedChips).toBe(440);
	expect(winning.bets).toEqual(bets);
	expect(startGame(start("roulette", { bets }), () => 2).public.payout).toBe(
		0.85,
	);
	expect(startGame(start("roulette", { bets }), () => 0).public.payout).toBe(
		0.55,
	);
	expect(costMultiplier(0.55)).toBe(1.45);
	expect(
		startGame(
			start("roulette", {
				bets: [
					{ bet: "red", chips: 25 },
					{ bet: "black", chips: 25 },
				],
			}),
			() => 1,
		).public.payout,
	).toBe(1);
});

test("invalid chip bets are rejected before any random draw", () => {
	for (const bets of [
		[],
		null,
		[{ bet: "n37", chips: 1 }],
		[{ bet: "red", chips: 0 }],
		[{ bet: "red", chips: -1 }],
		[{ bet: "red", chips: 1.5 }],
		[{ bet: "red", chips: "10" }],
		[
			{ bet: "red", chips: 100 },
			{ bet: "black", chips: 1 },
		],
	]) {
		let draws = 0;
		expect(() =>
			startGame(start("roulette", { bets }), () => {
				draws++;
				return 0;
			}),
		).toThrow();
		expect(draws).toBe(0);
	}
	const duplicate = startGame(
		start("roulette", {
			bets: [
				{ bet: "n0", chips: 5 },
				{ bet: "n0", chips: 10 },
			],
		}),
		() => 0,
	).public;
	expect(duplicate.kind === "roulette" && duplicate.bets).toEqual([
		{ bet: "n0", chips: 15 },
	]);
	expect(duplicate.payout).toBe(6.25);
});
