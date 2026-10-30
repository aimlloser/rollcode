/** accounting is independent of provider pricing and real money. */
export const TOKENS_PER_CREDIT = 1000;
export const STARTING_DEMO_CREDITS = 10000;
export const STARTING_DEMO_TOKENS = STARTING_DEMO_CREDITS * TOKENS_PER_CREDIT;

export type DemoWallet = {
	balanceCredits: number;
	balanceTokens: number;
	actualTokens: number;
	simulatedTokens: number;
	responses: number;
};

export function creditAmount(tokens: number): string {
	return (tokens / TOKENS_PER_CREDIT).toLocaleString(undefined, {
		maximumFractionDigits: 6,
	});
}

export function demoCredits(tokens: number): string {
	return `${creditAmount(tokens)} credits`;
}
