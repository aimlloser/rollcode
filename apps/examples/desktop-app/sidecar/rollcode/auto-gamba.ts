import { randomInt, randomUUID } from "node:crypto";
import type { SqliteDb } from "@cline/shared/db";
import { cardScore, GAME_IDS, type GameRequest } from "./game-types";
import type { Roll } from "./ledger";
import {
	autoTargetTokens,
	validateAutoRule,
	type AutoStopMode,
	type AutoStopRule,
} from "./auto-rules";

export type AutoJobStatus = "running" | "free" | "won" | "stopped" | "error";
export type AutoGambaSnapshot = {
	enabled: boolean;
	mode: AutoStopMode;
	targetPercent: number;
	jobs: {
		id: string;
		status: AutoJobStatus;
		steps: number;
		mode: AutoStopMode;
		targetPercent: number;
		targetTokens: number;
		error: string | null;
		roll: Roll;
	}[];
};
type Job = {
	mode: AutoStopMode;
	target_percent: number;
	id: string;
	status: AutoJobStatus;
	steps: number;
	pending: string | null;
	error: string | null;
};

/** Persist the next request before playing it, so restarts and workers reuse its receipt. */
export class AutoGamba {
	constructor(
		private db: SqliteDb,
		private play: (id: string, request: GameRequest) => Roll,
	) {
		db.exec(`CREATE TABLE IF NOT EXISTS auto_gamba_preferences (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0);
   INSERT OR IGNORE INTO auto_gamba_preferences(id,enabled) VALUES(1,0);
   CREATE TABLE IF NOT EXISTS auto_gamba_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, steps INTEGER NOT NULL DEFAULT 0, pending TEXT, error TEXT, updated_at INTEGER NOT NULL);`);
		// Serialize additive migration against any other local backend opening the ledger.
		db.exec("BEGIN IMMEDIATE");
		try {
			for (const table of ["auto_gamba_preferences", "auto_gamba_jobs"]) {
				const columns = new Set(
					(
						db.prepare(`PRAGMA table_info(${table})`).all() as {
							name: string;
						}[]
					).map((row) => row.name),
				);
				if (!columns.has("mode"))
					db.exec(
						`ALTER TABLE ${table} ADD COLUMN mode TEXT NOT NULL DEFAULT 'all-or-nothing'`,
					);
				if (!columns.has("target_percent"))
					db.exec(
						`ALTER TABLE ${table} ADD COLUMN target_percent REAL NOT NULL DEFAULT 50`,
					);
			}
			db.exec("COMMIT");
		} catch (error) {
			db.exec("ROLLBACK");
			throw error;
		}
	}
	enabled() {
		return !!(
			this.db
				.prepare("SELECT enabled FROM auto_gamba_preferences WHERE id=1")
				.get() as { enabled: number }
		).enabled;
	}
	rule(): AutoStopRule {
		const row = this.db
			.prepare(
				"SELECT mode,target_percent FROM auto_gamba_preferences WHERE id=1",
			)
			.get() as { mode: AutoStopMode; target_percent: number };
		return { mode: row.mode, targetPercent: row.target_percent };
	}
	setRule(mode: unknown, targetPercent: unknown) {
		const rule = validateAutoRule(mode, targetPercent);
		this.db
			.prepare(
				"UPDATE auto_gamba_preferences SET mode=?,target_percent=? WHERE id=1",
			)
			.run(rule.mode, rule.targetPercent);
		return this.snapshot();
	}
	enqueue(roll: Roll) {
		if (this.enabled() && roll.usageReported !== false && roll.tokens > 0) {
			const rule = this.rule();
			this.db
				.prepare(
					"INSERT OR IGNORE INTO auto_gamba_jobs(id,status,updated_at,mode,target_percent) VALUES (?,'running',?,?,?)",
				)
				.run(roll.id, Date.now(), rule.mode, rule.targetPercent);
		}
	}
	isRunning(id: string) {
		return !!this.db
			.prepare("SELECT id FROM auto_gamba_jobs WHERE id=? AND status='running'")
			.get(id);
	}
	ownsRequest(id: string, requestId: string) {
		const job = this.db
			.prepare(
				"SELECT pending FROM auto_gamba_jobs WHERE id=? AND status='running'",
			)
			.get(id) as { pending: string | null } | null;
		return (
			this.enabled() &&
			!!job?.pending &&
			(JSON.parse(job.pending) as GameRequest).requestId === requestId
		);
	}
	setEnabled(enabled: boolean) {
		this.db.exec("BEGIN IMMEDIATE");
		try {
			this.db
				.prepare("UPDATE auto_gamba_preferences SET enabled=? WHERE id=1")
				.run(enabled ? 1 : 0);
			if (!enabled)
				this.db
					.prepare(
						"UPDATE auto_gamba_jobs SET status='stopped',updated_at=? WHERE status='running'",
					)
					.run(Date.now());
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
		return this.snapshot();
	}
	stop(id: string) {
		this.db
			.prepare(
				"UPDATE auto_gamba_jobs SET status='stopped',updated_at=? WHERE id=? AND status='running'",
			)
			.run(Date.now(), id);
		return this.snapshot();
	}
	snapshot(): AutoGambaSnapshot {
		const rows = this.db
			.prepare(`SELECT j.id,j.status,j.steps,j.error,j.mode,j.target_percent,r.data FROM auto_gamba_jobs j JOIN rolls r ON r.id=j.id
   WHERE j.status='running' OR j.id IN
    (SELECT id FROM auto_gamba_jobs WHERE status!='running' ORDER BY updated_at DESC LIMIT 8)
   ORDER BY CASE WHEN j.status='running' THEN 0 ELSE 1 END,j.updated_at DESC`)
			.all() as (Job & { data: string })[];
		return {
			enabled: this.enabled(),
			...this.rule(),
			jobs: rows.map((row) => {
				const roll = JSON.parse(row.data) as Roll;
				return {
					id: row.id,
					status: row.status,
					steps: row.steps,
					mode: row.mode,
					targetPercent: row.target_percent,
					targetTokens: autoTargetTokens(roll.tokens, {
						mode: row.mode,
						targetPercent: row.target_percent,
					}),
					error: row.error,
					roll: { ...roll, rounds: roll.rounds?.slice(-5) },
				};
			}),
		};
	}
	/** Advance every active response once per beat instead of sharing one turn between them. */
	tick(): { rolls: Roll[]; changed: boolean } {
		const rolls: Roll[] = [];
		let changed = false;
		if (!this.enabled()) return { rolls, changed };
		const jobs = this.db
			.prepare(
				"SELECT id FROM auto_gamba_jobs WHERE status='running' ORDER BY updated_at ASC",
			)
			.all() as { id: string }[];
		for (const job of jobs) {
			try {
				const update = this.tickJob(job.id);
				if (update.roll) rolls.push(update.roll);
				changed ||= update.changed;
			} catch (error) {
				this.db
					.prepare(
						"UPDATE auto_gamba_jobs SET status='error',error=?,updated_at=? WHERE id=? AND status='running'",
					)
					.run(
						error instanceof Error ? error.message : "Auto Gamba stopped.",
						Date.now(),
						job.id,
					);
				changed = true;
			}
		}
		return { rolls, changed };
	}
	private tickJob(id: string): { roll?: Roll; changed: boolean } {
		let job: Job | null = null;
		let request: GameRequest | undefined;
		this.db.exec("BEGIN IMMEDIATE");
		try {
			if (this.enabled())
				job = this.db
					.prepare(
						"SELECT id,status,steps,pending,error,mode,target_percent FROM auto_gamba_jobs WHERE id=? AND status='running'",
					)
					.get(id) as Job | null;
			if (job) {
				const row = this.db
					.prepare("SELECT data FROM rolls WHERE id=?")
					.get(job.id) as { data: string } | null;
				if (!row) {
					this.db.prepare("DELETE FROM auto_gamba_jobs WHERE id=?").run(job.id);
					job = null;
				} else {
					const roll = JSON.parse(row.data) as Roll;
					if (
						roll.game?.phase !== "active" &&
						(roll.simulatedTokens ?? roll.tokens) <=
							autoTargetTokens(roll.tokens, {
								mode: job.mode,
								targetPercent: job.target_percent,
							})
					) {
						this.db
							.prepare(
								"UPDATE auto_gamba_jobs SET status=?,pending=NULL,updated_at=? WHERE id=?",
							)
							.run(
								(roll.simulatedTokens ?? roll.tokens) === 0 ? "free" : "won",
								Date.now(),
								job.id,
							);
					} else {
						request = job.pending
							? (JSON.parse(job.pending) as GameRequest)
							: nextAutoRequest(roll, {
									mode: job.mode,
									targetPercent: job.target_percent,
								});
						this.db
							.prepare(
								"UPDATE auto_gamba_jobs SET pending=?,updated_at=? WHERE id=?",
							)
							.run(JSON.stringify(request), Date.now(), job.id);
					}
				}
			}
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			throw error;
		}
		if (!job || !request) return { changed: !!job };
		try {
			const roll = this.play(job.id, request);
			this.db
				.prepare(`UPDATE auto_gamba_jobs SET status=?,steps=steps+1,pending=NULL,error=NULL,updated_at=?
    WHERE id=? AND pending=? AND status='running'`)
				.run(
					roll.simulatedTokens === 0
						? "free"
						: roll.game?.phase === "complete" &&
								(roll.simulatedTokens ?? roll.tokens) <=
									autoTargetTokens(roll.tokens, {
										mode: job.mode,
										targetPercent: job.target_percent,
									})
							? "won"
							: "running",
					Date.now(),
					job.id,
					JSON.stringify(request),
				);
			return { roll, changed: true };
		} catch (error) {
			this.db
				.prepare(
					"UPDATE auto_gamba_jobs SET status='error',error=?,updated_at=? WHERE id=? AND pending=? AND status='running'",
				)
				.run(
					error instanceof Error
						? error.message
						: "Auto Gamba stopped. Reopen this response to continue manually.",
					Date.now(),
					job.id,
					JSON.stringify(request),
				);
			return { changed: true };
		}
	}
}

function nextAutoRequest(roll: Roll, rule: AutoStopRule): GameRequest {
	const state = roll.game;
	const base = { requestId: randomUUID(), revision: state?.revision ?? 0 };
	if (state?.phase === "active") {
		if (state.kind === "blackjack")
			return {
				...base,
				game: "blackjack",
				action: cardScore(state.player) < 17 ? "hit" : "stand",
			};
		if (state.kind === "mines") {
			const stake =
				roll.activeRound?.stakeTokens ?? roll.simulatedTokens ?? roll.tokens;
			if (
				state.costFactor !== undefined &&
				stake * state.costFactor <= autoTargetTokens(roll.tokens, rule)
			)
				return { ...base, game: "mines", action: "cashout" };
			if (state.revealed.length >= 3 && randomInt(2) === 0)
				return { ...base, game: "mines", action: "cashout" };
			const hidden = Array.from({ length: 25 }, (_, i) => i).filter(
				(i) => !state.revealed.includes(i),
			);
			return {
				...base,
				game: "mines",
				action: "pick",
				index: hidden[randomInt(hidden.length)],
			};
		}
		throw new Error("Unsupported active game");
	}
	let game = GAME_IDS[randomInt(GAME_IDS.length)]!;
	const stake = roll.simulatedTokens ?? roll.tokens;
	if (game === "roulette" && stake < 1) game = "slots";
	return {
		...base,
		game,
		action: "start",
		config: {
			threshold: 50,
			direction: randomInt(2) ? "over" : "under",
			rows: 8,
			risk: "low",
			count: 3,
			...(game === "roulette"
				? {
						bets: [
							{ bet: randomInt(2) ? "red" : "black", chips: Math.floor(stake) },
						],
					}
				: {}),
		},
	};
}
