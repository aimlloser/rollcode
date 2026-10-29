import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RollLedger } from "./ledger";
import type { GameRequest } from "./game-types";

test("game decisions persist once across connections, retries, restart and stale clients", () => {
	const dir = mkdtempSync(join(tmpdir(), "rollcode-games-")),
		path = join(dir, "test.sqlite");
	let a = new RollLedger(path);
	const b = new RollLedger(path);
	try {
		a.track("session");
		const row = a.record({
			event: "agent.done",
			eventId: "done",
			sessionId: "session",
			payload: {
				reason: "completed",
				usage: { inputTokens: 100, outputTokens: 20, totalCost: 1 },
			},
		})!;
		const request: GameRequest = {
			requestId: "start",
			revision: 0,
			game: "mines",
			action: "start",
			config: { count: 3 },
		};
		const initial = a.play(row.id, request);
		expect(initial.game?.phase).toBe("active");
		expect(initial.game).not.toHaveProperty("secret");
		expect(initial.game).not.toHaveProperty("mines");
		expect(b.play(row.id, request)).toEqual(initial);
		expect(() => b.play(row.id, { ...request, requestId: "other" })).toThrow(
			"another window",
		);
		expect(() => b.gamble(row.id)).toThrow("Finish the active game");
		expect(() =>
			b.play(row.id, {
				...request,
				requestId: "bad",
				revision: 1,
				action: "pick",
				index: 25,
			}),
		).toThrow();
		expect(b.list()[0]?.game?.revision).toBe(1);
		a.close();
		a = new RollLedger(path);
		expect(a.list()[0]).toEqual(initial);
		const finish = {
			...request,
			requestId: "cashout",
			revision: 1,
			action: "cashout" as const,
		};
		const settled = a.play(row.id, finish);
		expect(settled.multiplier).toBe(1);
		expect(settled.simulatedTokens).toBe(120);
		expect(b.play(row.id, finish)).toEqual(settled);
		expect(b.play(row.id, request)).toEqual(settled);
		expect(
			b.play(row.id, { ...request, requestId: "switch", game: "dice" }),
		).toEqual(settled);
		expect(b.gamble(row.id)).toEqual(settled);
		for (const game of ["blackjack", "dice", "plinko", "roulette"] as const) {
			const task = a.record({
				event: "agent.done",
				eventId: game,
				sessionId: "session",
				payload: {
					reason: "completed",
					usage: { inputTokens: 1, outputTokens: 1 },
				},
			})!;
			const chipRequest = {
				...request,
				game,
				...(game === "roulette"
					? {
							config: {
								bets: [
									{ bet: "n7", chips: 1 },
									{ bet: "red", chips: 1 },
								],
							},
						}
					: {}),
			};
			const result = a.play(task.id, chipRequest);
			expect(result.game?.kind).toBe(game);
			expect(b.play(task.id, chipRequest)).toEqual(result);
			if (game === "roulette") {
				a.close();
				a = new RollLedger(path);
				expect(a.list().find((r) => r.id === task.id)).toEqual(result);
				expect(
					b.play(task.id, {
						...chipRequest,
						requestId: "cannot-change-chips",
						config: { bets: [{ bet: "n0", chips: 100 }] },
					}),
				).toEqual(result);
			}
		}
	} finally {
		a.close();
		b.close();
		rmSync(dir, { recursive: true, force: true });
	}
});
