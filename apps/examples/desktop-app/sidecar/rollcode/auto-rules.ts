export type AutoStopMode = "all-or-nothing" | "percent";
export type AutoStopRule = { mode: AutoStopMode; targetPercent: number };
export const DEFAULT_AUTO_RULE: AutoStopRule = {
	mode: "all-or-nothing",
	targetPercent: 50,
};

export function validateAutoRule(
	mode: unknown,
	targetPercent: unknown,
): AutoStopRule {
	if (mode !== "all-or-nothing" && mode !== "percent")
		throw new Error("Choose All or nothing or Percent wins.");
	if (
		typeof targetPercent !== "number" ||
		!Number.isFinite(targetPercent) ||
		targetPercent < 1 ||
		targetPercent > 100
	)
		throw new Error("Enter a percentage from 1 to 100.");
	return { mode, targetPercent };
}

export function autoTargetTokens(
	originalTokens: number,
	rule: AutoStopRule,
): number {
	return rule.mode === "all-or-nothing"
		? 0
		: Number((originalTokens * (1 - rule.targetPercent / 100)).toFixed(6));
}
