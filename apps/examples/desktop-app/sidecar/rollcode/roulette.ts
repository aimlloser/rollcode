import { costMultiplier, RED_NUMBERS, type RouletteBet } from "./game-types";

/** Red/black wins save the full placement; losses add its full amount. */
export function rouletteCostMultiplier(bet: string, number: number): number {
	const returned = rouletteReturn(bet, number);
	if (bet === "red" || bet === "black") return returned > 0 ? 0 : 2;
	return costMultiplier(returned);
}

export function normalizeRouletteBets(
	value: unknown,
	budget = 100,
): RouletteBet[] {
	if (
		!Number.isFinite(budget) ||
		budget < 1 ||
		budget > Number.MAX_SAFE_INTEGER
	)
		throw new Error("Roulette needs at least one simulated token");
	if (!Array.isArray(value) || value.length < 1 || value.length > 46)
		throw new Error("Place tokens on at least one bet");
	const allowed = new Set([
		"red",
		"black",
		"odd",
		"even",
		"low",
		"high",
		"dozen1",
		"dozen2",
		"dozen3",
		...Array.from({ length: 37 }, (_, i) => `n${i}`),
	]);
	const totals = new Map<string, number>();
	let total = 0;
	for (const item of value) {
		if (
			!item ||
			typeof item !== "object" ||
			!allowed.has(item.bet) ||
			!Number.isSafeInteger(item.chips) ||
			item.chips < 1 ||
			item.chips > budget
		)
			throw new Error("Invalid Roulette chips or destination");
		total += item.chips;
		if (total > budget)
			throw new Error("Placed tokens exceed this task’s token stake");
		totals.set(item.bet, (totals.get(item.bet) ?? 0) + item.chips);
	}
	return Array.from(totals, ([bet, chips]) => ({ bet, chips }));
}

/** Gross return includes the chips placed on a winning destination. */
export function rouletteReturn(bet: string, number: number): number {
	if (bet.startsWith("n")) return number === Number(bet.slice(1)) ? 36 : 0;
	if (bet.startsWith("dozen")) {
		const dozen = Number(bet.slice(-1));
		return number > (dozen - 1) * 12 && number <= dozen * 12 ? 3 : 0;
	}
	if (number === 0) return 0;
	const won =
		bet === "red"
			? RED_NUMBERS.includes(number)
			: bet === "black"
				? !RED_NUMBERS.includes(number)
				: bet === "odd"
					? number % 2 === 1
					: bet === "even"
						? number % 2 === 0
						: bet === "low"
							? number <= 18
							: number >= 19;
	return won ? 2 : 0;
}
