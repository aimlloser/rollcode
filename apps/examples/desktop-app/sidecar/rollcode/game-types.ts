export const GAME_IDS = [
	"blackjack",
	"dice",
	"plinko",
	"mines",
	"roulette",
	"slots",
] as const;
export type GameId = (typeof GAME_IDS)[number];
export const CHIP_DENOMINATIONS = [1, 10, 100, 1000, 10000] as const;
export type RouletteBet = { bet: string; chips: number };
export type GameRequest = {
	requestId: string;
	revision: number;
	game: GameId;
	action: "start" | "hit" | "stand" | "pick" | "cashout";
	config?: Record<string, unknown>;
	index?: number;
};
type Base = {
	revision: number;
	phase: "active" | "complete";
	payout: number | null;
	message: string;
	/** Direct multiplier applied to the round stake, including weighted multi-bet costs. */
	costFactor?: number;
};
export type PublicGame = Base &
	(
		| {
				kind: "slots";
				reels: number[];
		  }
		| {
				kind: "dice";
				threshold: number;
				direction: "over" | "under";
				value: number;
		  }
		| {
				kind: "plinko";
				rows: number;
				risk: string;
				path: number[];
				bucket: number;
				payouts?: number[];
		  }
		| {
				kind: "roulette";
				bet: string;
				number: number;
				bets?: RouletteBet[];
				totalChips?: number;
				returnedChips?: number;
				chipUnit?: "tokens";
				chipBudget?: number;
		  }
		| {
				kind: "mines";
				count: number;
				revealed: number[];
				mines?: number[];
				hit?: number;
		  }
		| { kind: "blackjack"; player: number[]; dealer: (number | null)[] }
	);

export const RED_NUMBERS = [
	1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];
export const WHEEL = [
	0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
	16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export function cardScore(cards: number[]) {
	let total = 0,
		aces = 0;
	for (const card of cards) {
		const rank = card % 13;
		if (rank === 0) {
			total += 11;
			aces++;
		} else total += Math.min(rank + 1, 10);
	}
	while (total > 21 && aces-- > 0) total -= 10;
	return total;
}
export function minesPayout(count: number, revealed: number) {
	let probability = 1;
	for (let i = 0; i < revealed; i++) probability *= (25 - count - i) / (25 - i);
	return revealed === 0 ? 1 : Math.floor((0.99 / probability) * 10000) / 10000;
}
/** Direct adjusted-cost multiplier: starts at 2× and falls after every safe pick. */
export function minesCostMultiplier(count: number, revealed: number) {
	let survival = 1;
	for (let i = 0; i < revealed; i++) survival *= (25 - count - i) / (25 - i);
	return Number((2 * survival).toFixed(6));
}
/** Original paytables for this adjusted-credit implementation. */
export function plinkoPayouts(rows: number, risk: string): number[] {
	const half: Record<string, Record<number, number[]>> = {
		low: {
			8: [0.5, 0.75, 1, 1.5, 2],
			12: [0.5, 0.65, 0.8, 1, 1.25, 1.6, 2],
			16: [0.5, 0.6, 0.7, 0.85, 1, 1.2, 1.4, 1.7, 2],
		},
		medium: {
			8: [0.4, 0.7, 1, 2, 2.5],
			12: [0.4, 0.55, 0.75, 1, 1.4, 2, 2.5],
			16: [0.4, 0.5, 0.65, 0.8, 1, 1.3, 1.7, 2.1, 2.5],
		},
		high: {
			8: [0.25, 0.5, 1, 2, 3],
			12: [0.25, 0.4, 0.6, 1, 1.5, 2.25, 3],
			16: [0.25, 0.35, 0.5, 0.7, 1, 1.4, 1.9, 2.5, 3],
		},
	};
	const values = half[risk]?.[rows];
	if (!values) throw new Error("Invalid Plinko configuration");
	const slots = [...values, ...values.slice(0, -1).reverse()];
	slots[0] = 0;
	slots[slots.length - 1] = 0;
	return slots;
}
export const costMultiplier = (payout: number) =>
	payout > 0 ? Math.min(2, 1 / payout) : 2;

/** Only used to display previously saved rounds without rewriting their outcomes. */
export function legacyPlinkoPayouts(rows: number, risk: string): number[] {
	const half: Record<string, Record<number, number[]>> = {
		low: {
			8: [5, 2, 1.1, 1, 0.5],
			12: [8, 3, 1.6, 1.2, 1, 0.7, 0.5],
			16: [12, 6, 3, 1.7, 1.3, 1.1, 1, 0.6, 0.5],
		},
		medium: {
			8: [12, 3, 1.5, 0.5, 0.3],
			12: [30, 10, 4, 2, 0.8, 0.4, 0.2],
			16: [80, 25, 10, 4, 2, 1, 0.5, 0.3, 0.2],
		},
		high: {
			8: [30, 4, 1, 0.2, 0.1],
			12: [120, 20, 5, 1, 0.4, 0.2, 0.1],
			16: [500, 80, 20, 5, 2, 0.5, 0.2, 0.1, 0.1],
		},
	};
	const values = half[risk]?.[rows];
	if (!values) throw new Error("Invalid saved Plinko configuration");
	return [...values, ...values.slice(0, -1).reverse()];
}
