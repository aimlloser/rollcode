/** Uniform independent symbols; shared by the server settlement and reel artwork. */
export const SLOT_SYMBOLS = [
	{ id: "lucky-dice", label: "Lucky Dice" },
	{ id: "ace-high", label: "Ace High" },
	{ id: "casino-chip", label: "Casino Chip" },
	{ id: "jackpot", label: "Jackpot" },
] as const;

export function slotOutcome(reels: number[]) {
	if (
		reels.length !== 3 ||
		reels.some((n) => !Number.isInteger(n) || n < 0 || n >= SLOT_SYMBOLS.length)
	)
		throw new Error("Invalid slot symbols");
	const matches = new Set(reels).size;
	if (matches === 1 && reels[0] === 3)
		return { costFactor: 0, message: "JACKPOT · Free task!" };
	if (matches === 1)
		return {
			costFactor: 0.25,
			message: "Three of a kind · 75% lower token cost",
		};
	if (matches === 2)
		return { costFactor: 0.5, message: "Matching pair · Half token cost" };
	return { costFactor: 2, message: "No match · Double token cost" };
}
