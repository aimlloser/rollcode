import { loadSqliteDb, type SqliteDb } from "@cline/shared/db";
import { randomInt } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
	advanceGame,
	startGame,
	validateRequest,
	type PrivateGame,
} from "./game-engine";
import { costMultiplier, type PublicGame } from "./game-types";
import { AutoGamba } from "./auto-gamba";
import {
	STARTING_DEMO_TOKENS,
	TOKENS_PER_CREDIT,
	type DemoWallet,
} from "./demo-wallet";

export type RoundHistory = {
	id: string;
	startedAt: string;
	completedAt: string;
	stakeTokens: number;
	resultTokens: number;
	multiplier: number;
	game?: PublicGame;
};

export type Roll = {
	id: string;
	sessionId: string;
	completedAt: string;
	tokens: number;
	inputTokens?: number;
	outputTokens?: number;
	cacheReadTokens?: number;
	simulatedTokens?: number;
	usageReported?: boolean;
	baseCost: number | null;
	simulatedCost: number | null;
	multiplier: number | null;
	game?: PublicGame;
	rounds?: RoundHistory[];
	activeRound?: { id: string; startedAt: string; stakeTokens: number };
	runId?: string;
	messageIds?: string[];
	acknowledged: boolean;
};

export function multiplierFor(
	ticket: number,
): Exclude<Roll["multiplier"], null> {
	if (!Number.isInteger(ticket) || ticket < 0 || ticket >= 100)
		throw new Error("Invalid roll ticket");
	return ticket < 10 ? 0 : ticket < 30 ? 0.5 : ticket < 80 ? 1 : 2;
}

/** Local, durable, multi-process safe. Randomness is drawn only inside the write lock. */
export class RollLedger {
	private db: SqliteDb;
	readonly auto: AutoGamba;
	constructor(path: string) {
		mkdirSync(dirname(path), { recursive: true });
		this.db = loadSqliteDb(path);
		this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
			CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY);
			CREATE TABLE IF NOT EXISTS rolls (id TEXT PRIMARY KEY, data TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
			CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, state TEXT NOT NULL);
			CREATE TABLE IF NOT EXISTS game_receipts (id TEXT NOT NULL, request_id TEXT NOT NULL, PRIMARY KEY(id,request_id));
			CREATE TABLE IF NOT EXISTS demo_wallet (id INTEGER PRIMARY KEY CHECK(id=1), funding_tokens REAL NOT NULL);
			CREATE TABLE IF NOT EXISTS wallet_resets (request_id TEXT PRIMARY KEY);`);
		this.db
			.prepare(
				"INSERT OR IGNORE INTO demo_wallet(id,funding_tokens) VALUES (1,?)",
			)
			.run(STARTING_DEMO_TOKENS);
		this.auto = new AutoGamba(this.db, (id, request) =>
			this.play(id, request, true),
		);
	}
	/** Derive charges from durable response costs: retries never debit twice. */
	wallet(): DemoWallet {
		const row = this.db
			.prepare(`SELECT
			(SELECT funding_tokens FROM demo_wallet WHERE id=1) AS funding,
			COALESCE(SUM(json_extract(data,'$.tokens')),0) AS actual,
			COALESCE(SUM(COALESCE(json_extract(data,'$.simulatedTokens'),
				json_extract(data,'$.tokens') * COALESCE(json_extract(data,'$.multiplier'),1))),0) AS spent,
			COUNT(*) AS responses FROM rolls`)
			.get() as {
			funding: number;
			actual: number;
			spent: number;
			responses: number;
		};
		const balanceTokens = Number((row.funding - row.spent).toFixed(6));
		return {
			balanceTokens,
			balanceCredits: balanceTokens / TOKENS_PER_CREDIT,
			actualTokens: row.actual,
			simulatedTokens: row.spent,
			responses: row.responses,
		};
	}
	/** A reset adds funds without deleting usage, games, or in-flight stakes. */
	resetWallet(requestId: string): DemoWallet {
		if (!/^[\w-]{1,100}$/.test(requestId))
			throw new Error("Invalid reset request");
		this.db.exec("BEGIN IMMEDIATE");
		try {
			if (
				!this.db
					.prepare("SELECT request_id FROM wallet_resets WHERE request_id=?")
					.get(requestId)
			) {
				const current = this.wallet();
				this.db
					.prepare("UPDATE demo_wallet SET funding_tokens=? WHERE id=1")
					.run(current.simulatedTokens + STARTING_DEMO_TOKENS);
				this.db
					.prepare("INSERT INTO wallet_resets(request_id) VALUES (?)")
					.run(requestId);
			}
			const wallet = this.wallet();
			this.db.exec("COMMIT");
			return wallet;
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}
	track(sessionId: string) {
		this.db
			.prepare("INSERT OR IGNORE INTO sessions(id) VALUES (?)")
			.run(sessionId);
	}
	record(event: {
		event: string;
		eventId?: string;
		sourceHubId?: string;
		sessionId?: string;
		timestamp?: number;
		payload?: Record<string, unknown>;
	}): Roll | undefined {
		if (
			event.event !== "agent.done" ||
			event.payload?.reason !== "completed" ||
			event.payload?.parentAgentId ||
			event.payload?.teamRole === "teammate" ||
			!event.sessionId ||
			!event.eventId
		)
			return;
		const sessionId = event.sessionId;
		if (!this.db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId))
			return;
		const id =
			typeof event.payload?.runId === "string"
				? `${sessionId}:${event.payload.runId}`
				: `${event.sourceHubId ?? "local"}:${event.eventId}`;
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const existing = this.db
				.prepare("SELECT data, acknowledged FROM rolls WHERE id = ?")
				.get(id) as { data: string; acknowledged: number } | null;
			if (existing) {
				this.db.exec("COMMIT");
				return {
					...JSON.parse(existing.data),
					acknowledged: !!existing.acknowledged,
				} as Roll;
			}
			const usage = event.payload?.usage as Record<string, unknown> | undefined;
			const valid = (n: unknown): n is number =>
				typeof n === "number" && Number.isFinite(n) && n >= 0;
			const baseCost = valid(usage?.totalCost) ? usage.totalCost : null;
			// Cline's normalized input total already includes cached input.
			const tokens = ["inputTokens", "outputTokens"].reduce(
				(sum, key) => sum + (valid(usage?.[key]) ? (usage[key] as number) : 0),
				0,
			);
			const multiplier = null;
			const roll: Roll = {
				id,
				sessionId,
				completedAt: new Date(event.timestamp ?? Date.now()).toISOString(),
				tokens,
				usageReported: valid(usage?.inputTokens) && valid(usage?.outputTokens),
				inputTokens: valid(usage?.inputTokens) ? usage.inputTokens : undefined,
				outputTokens: valid(usage?.outputTokens)
					? usage.outputTokens
					: undefined,
				cacheReadTokens: valid(usage?.cacheReadTokens)
					? usage.cacheReadTokens
					: undefined,
				simulatedTokens: tokens,
				baseCost,
				simulatedCost: baseCost,
				multiplier,
				runId:
					typeof event.payload?.runId === "string"
						? event.payload.runId
						: undefined,
				messageIds: Array.isArray(event.payload?.messageIds)
					? event.payload.messageIds.filter(
							(id): id is string => typeof id === "string",
						)
					: undefined,
				acknowledged: false,
			};
			this.db
				.prepare("INSERT INTO rolls(id, data) VALUES (?, ?)")
				.run(id, JSON.stringify(roll));
			this.auto.enqueue(roll);
			this.db.exec("COMMIT");
			return roll;
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}
	/** The first explicit click draws and commits. Retries and other windows read the same result. */
	gamble(id: string, draw = () => randomInt(100)): Roll {
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const row = this.db
				.prepare("SELECT data, acknowledged FROM rolls WHERE id = ?")
				.get(id) as { data: string; acknowledged: number } | null;
			if (!row) throw new Error("Completed task not found");
			const existing = JSON.parse(row.data) as Roll;
			let roll = { ...existing, acknowledged: !!row.acknowledged };
			if (this.auto.isRunning(id))
				throw new Error(
					"Auto Gamba is playing this response. Stop it before playing manually.",
				);
			if (roll.multiplier === null) {
				if (roll.game) throw new Error("Finish the active game first");
				if (roll.usageReported === false)
					throw new Error("Token usage was not reported for this task.");
				const multiplier = multiplierFor(draw());
				roll = {
					...roll,
					multiplier,
					simulatedTokens: roll.tokens * multiplier,
					simulatedCost:
						roll.baseCost === null ? null : roll.baseCost * multiplier,
					acknowledged: true,
				};
				this.db
					.prepare("UPDATE rolls SET data = ?, acknowledged = 1 WHERE id = ?")
					.run(JSON.stringify(roll), id);
			}
			this.db.exec("COMMIT");
			return roll;
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}
	/** All decisions, hidden state, receipts and settlement commit in one SQLite transaction. */
	play(id: string, request: unknown, automatic = false): Roll {
		validateRequest(request);
		this.db.exec("BEGIN IMMEDIATE");
		try {
			const row = this.db
				.prepare("SELECT data, acknowledged FROM rolls WHERE id = ?")
				.get(id) as { data: string; acknowledged: number } | null;
			if (!row) throw new Error("Completed task not found");
			const roll: Roll = {
				...JSON.parse(row.data),
				acknowledged: !!row.acknowledged,
			};
			const receipt = this.db
				.prepare(
					"SELECT request_id FROM game_receipts WHERE id = ? AND request_id = ?",
				)
				.get(id, request.requestId);
			if (receipt) {
				this.db.exec("COMMIT");
				return roll;
			}
			if (
				automatic
					? !this.auto.ownsRequest(id, request.requestId)
					: this.auto.isRunning(id)
			)
				throw new Error(
					automatic
						? "Auto Gamba was stopped."
						: "Auto Gamba is playing this response. Stop it before playing manually.",
				);
			if (roll.usageReported === false)
				throw new Error("Token usage was not reported for this task.");
			const stored = this.db
				.prepare("SELECT state FROM games WHERE id = ?")
				.get(id) as { state: string } | null;
			const previous = stored
				? (JSON.parse(stored.state) as PrivateGame)
				: undefined;
			if (
				request.revision !==
				(previous?.public.revision ?? roll.game?.revision ?? 0)
			)
				throw new Error(
					"Game changed in another window. Reopen it to continue.",
				);
			if (request.action === "start" && previous?.public.phase === "active")
				throw new Error("A game is already in progress for this task");
			if (request.action !== "start" && previous?.public.phase !== "active")
				throw new Error("Start a game first");
			let state: PrivateGame;
			if (request.action === "start") {
				const stakeTokens =
					roll.simulatedTokens ?? roll.tokens * (roll.multiplier ?? 1);
				if (!Number.isFinite(stakeTokens) || stakeTokens <= 0)
					throw new Error("This message has no adjusted tokens left to play.");
				// Preserve outcomes saved before per-message round history was introduced.
				if (!roll.rounds && roll.multiplier !== null)
					roll.rounds = [
						{
							id: `previous:${roll.id}`,
							startedAt: roll.completedAt,
							completedAt: roll.completedAt,
							stakeTokens: roll.tokens,
							resultTokens: stakeTokens,
							multiplier: roll.multiplier,
							game: roll.game?.phase === "complete" ? roll.game : undefined,
						},
					];
				state = startGame(request, undefined, stakeTokens);
				state.public.revision =
					(previous?.public.revision ?? roll.game?.revision ?? 0) + 1;
				roll.activeRound = {
					id: request.requestId,
					startedAt: new Date().toISOString(),
					stakeTokens,
				};
			} else {
				state = advanceGame(previous!, request);
				roll.activeRound ??= {
					id: `resumed:${roll.id}`,
					startedAt: roll.completedAt,
					stakeTokens: roll.simulatedTokens ?? roll.tokens,
				};
			}
			roll.game = state.public;
			if (state.public.phase === "complete") {
				const roundMultiplier = Number(
					(
						state.public.costFactor ?? costMultiplier(state.public.payout!)
					).toFixed(6),
				);
				const round = roll.activeRound!;
				roll.simulatedTokens = Number(
					(round.stakeTokens * roundMultiplier).toFixed(6),
				);
				if (!Number.isFinite(roll.simulatedTokens))
					throw new Error("Adjusted token balance is too large");
				roll.multiplier =
					roll.tokens > 0 ? roll.simulatedTokens / roll.tokens : 0;
				roll.simulatedCost =
					roll.baseCost === null ? null : roll.baseCost * roll.multiplier;
				roll.rounds = [
					...(roll.rounds ?? []),
					{
						...round,
						completedAt: new Date().toISOString(),
						resultTokens: roll.simulatedTokens,
						multiplier: roundMultiplier,
						game: state.public,
					},
				];
				delete roll.activeRound;
				roll.acknowledged = true;
			}
			this.db
				.prepare(
					"INSERT INTO games(id,state) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state",
				)
				.run(id, JSON.stringify(state));
			this.db
				.prepare("INSERT INTO game_receipts(id,request_id) VALUES (?,?)")
				.run(id, request.requestId);
			this.db
				.prepare("UPDATE rolls SET data = ?, acknowledged = ? WHERE id = ?")
				.run(JSON.stringify(roll), roll.acknowledged ? 1 : 0, id);
			this.db.exec("COMMIT");
			return roll;
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
	}
	list(): Roll[] {
		return (
			this.db
				.prepare("SELECT data, acknowledged FROM rolls ORDER BY rowid DESC")
				.all() as { data: string; acknowledged: number }[]
		).map((row) => ({
			...JSON.parse(row.data),
			acknowledged: !!row.acknowledged,
		}));
	}
	acknowledge(id: string) {
		this.db.prepare("UPDATE rolls SET acknowledged = 1 WHERE id = ?").run(id);
	}
	close() {
		this.db.close?.();
	}
}

let ledger: RollLedger | undefined;
export function rollLedger() {
	return (ledger ??= new RollLedger(
		process.env.ROLLCODE_LEDGER_PATH ||
			join(homedir(), ".rollcode", "ledger.sqlite"),
	));
}
