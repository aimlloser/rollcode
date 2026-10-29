import { describe, test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RollLedger, multiplierFor } from "./ledger";

describe("ROLLCODE ledger", () => {
	test("allocates the exact odds", () => {
		const counts = new Map<number, number>();
		for (let i = 0; i < 100; i++) {
			const m = multiplierFor(i);
			counts.set(m, (counts.get(m) ?? 0) + 1);
		}
		expect(Object.fromEntries(counts)).toEqual({
			0: 10,
			0.5: 20,
			1: 50,
			2: 20,
		});
		for (const invalid of [-1, 100, NaN, 0.1])
			expect(() => multiplierFor(invalid)).toThrow();
	});
	test("completion records normal cost; only an explicit roll draws, exactly once across windows and restarts", () => {
		const dir = mkdtempSync(join(tmpdir(), "rollcode-"));
		const path = join(dir, "ledger.sqlite");
		let first = new RollLedger(path);
		const second = new RollLedger(path);
		try {
			first.track("task");
			const event = {
				event: "agent.done",
				eventId: "one",
				sessionId: "task",
				payload: {
					reason: "completed",
					runId: "run-1",
					messageIds: ["message-1"],
					usage: {
						totalCost: 2,
						inputTokens: 10,
						outputTokens: 5,
						cacheReadTokens: 3,
					},
				},
			};
			const pending = first.record(event)!;
			expect(pending.multiplier).toBeNull();
			expect(pending.simulatedCost).toBe(2);
			expect(pending.tokens).toBe(15);
			expect(pending.inputTokens).toBe(10);
			expect(pending.outputTokens).toBe(5);
			expect(pending.cacheReadTokens).toBe(3);
			expect(pending.simulatedTokens).toBe(15);
			expect(pending.messageIds).toEqual(["message-1"]);
			expect(
				second.record({ ...event, eventId: "duplicate-envelope" }),
			).toEqual(pending);
			expect(second.list()).toHaveLength(1);
			const result = first.gamble(pending.id, () => 15);
			expect(result.simulatedCost).toBe(1);
			expect(result.multiplier).toBe(0.5);
			expect(result.simulatedTokens).toBe(7.5);
			expect(
				second.gamble(pending.id, () => {
					throw Error("must not draw again");
				}),
			).toEqual(result);
			first.close();
			first = new RollLedger(path);
			expect(first.gamble(pending.id, () => 99)).toEqual(result);
			expect(first.record(event)).toEqual(result);
			const retry = first.record({
				...event,
				eventId: "two",
				payload: { ...event.payload, runId: "run-2" },
			})!;
			expect(() =>
				first.gamble(retry.id, () => {
					throw Error("interrupted draw");
				}),
			).toThrow();
			expect(
				first.list().find((r) => r.id === retry.id)?.multiplier,
			).toBeNull();
			expect(first.gamble(retry.id, () => 99).simulatedCost).toBe(4);
			expect(() =>
				first.gamble("missing", () => {
					throw Error("must not draw");
				}),
			).toThrow("Completed task not found");
			for (const reason of [
				"error",
				"aborted",
				"max_iterations",
				"mistake_limit",
			])
				expect(first.record({ ...event, payload: { reason } })).toBeUndefined();
			expect(first.record({ ...event, sessionId: "other" })).toBeUndefined();
			expect(first.record({ ...event, eventId: undefined })).toBeUndefined();
			expect(
				first.record({
					...event,
					payload: { ...event.payload, parentAgentId: "parent" },
				}),
			).toBeUndefined();
			expect(
				first.record({
					...event,
					payload: { ...event.payload, teamRole: "teammate" },
				}),
			).toBeUndefined();
			const unknown = first.record({
				...event,
				eventId: "unknown",
				payload: {
					reason: "completed",
					usage: { totalCost: NaN, inputTokens: 3, outputTokens: 1 },
				},
			})!;
			expect(first.gamble(unknown.id, () => 0).simulatedCost).toBeNull();
			const missing = first.record({
				...event,
				eventId: "missing-usage",
				payload: { reason: "completed" },
			})!;
			expect(missing.usageReported).toBe(false);
			expect(() =>
				first.gamble(missing.id, () => {
					throw new Error("must not draw without usage");
				}),
			).toThrow("Token usage was not reported");
		} finally {
			first.close();
			second.close();
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
