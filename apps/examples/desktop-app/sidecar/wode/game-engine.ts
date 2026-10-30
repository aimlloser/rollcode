import {
	normalizeRouletteBets,
	rouletteReturn,
	rouletteCostMultiplier,
} from "./roulette";
import { randomInt } from "node:crypto";
import { SLOT_SYMBOLS, slotOutcome } from "./slots";
import {
	GAME_IDS,
	cardScore,
	minesPayout,
	minesCostMultiplier,
	plinkoPayouts,
	costMultiplier,
	type GameRequest,
	type PublicGame,
} from "./game-types";

export type PrivateGame = { public: PublicGame; secret: number[] };
type Draw = (max: number) => number;
const integer = (value: unknown, min: number, max: number): number => {
	if (
		typeof value !== "number" ||
		!Number.isInteger(value) ||
		value < min ||
		value > max
	)
		throw new Error("Invalid game setting");
	return value;
};
export function validateRequest(value: unknown): asserts value is GameRequest {
	const r = value as GameRequest;
	if (
		!r ||
		typeof r !== "object" ||
		typeof r.requestId !== "string" ||
		!/^[\w-]{1,100}$/.test(r.requestId) ||
		!GAME_IDS.includes(r.game) ||
		!["start", "hit", "stand", "pick", "cashout"].includes(r.action)
	)
		throw new Error("Invalid game request");
	integer(r.revision, 0, Number.MAX_SAFE_INTEGER - 1);
	if (
		r.config !== undefined &&
		(!r.config || typeof r.config !== "object" || Array.isArray(r.config))
	)
		throw new Error("Invalid game configuration");
}
function shuffled(size: number, draw: Draw) {
	const values = Array.from({ length: size }, (_, i) => i);
	for (let i = size - 1; i > 0; i--) {
		const j = draw(i + 1);
		[values[i], values[j]] = [values[j]!, values[i]!];
	}
	return values;
}
export function startGame(
	request: GameRequest,
	draw: Draw = randomInt,
	tokenStake = 100,
): PrivateGame {
	const config = request.config ?? {};
	const base = {
		revision: 1,
		phase: "complete" as const,
		payout: 0,
		message: "",
	};
	switch (request.game) {
		case "slots": {
			const reels = Array.from({ length: 3 }, () => draw(SLOT_SYMBOLS.length));
			const outcome = slotOutcome(reels);
			return {
				public: {
					...base,
					kind: "slots",
					reels,
					payout: outcome.costFactor,
					...outcome,
				},
				secret: [],
			};
		}
		case "dice": {
			const threshold = integer(config.threshold ?? 50, 2, 98);
			const direction = config.direction ?? "over";
			if (direction !== "over" && direction !== "under")
				throw new Error("Invalid Dice direction");
			// 10,000 equiprobable hundredths. Over includes the threshold, under excludes it.
			const value = draw(10000) / 100;
			const won = direction === "over" ? value >= threshold : value < threshold;
			const payout = won
				? 99 / (direction === "over" ? 100 - threshold : threshold)
				: 0;
			return {
				public: {
					...base,
					kind: "dice",
					threshold,
					direction,
					value,
					payout,
					message: won ? "Winning roll" : "Roll missed",
					costFactor: costMultiplier(payout),
				},
				secret: [],
			};
		}
		case "plinko": {
			const rows = config.rows ?? 12,
				risk = config.risk ?? "medium";
			if (
				![8, 12, 16].includes(rows as number) ||
				!["low", "medium", "high"].includes(risk as string)
			)
				throw new Error("Invalid Plinko configuration");
			const path = Array.from({ length: rows as number }, () => draw(2));
			const bucket = path.reduce((a, b) => a + b, 0);
			const payouts = plinkoPayouts(rows as number, risk as string);
			const payout = payouts[bucket]!;
			return {
				public: {
					...base,
					kind: "plinko",
					rows: rows as number,
					risk: risk as string,
					path,
					bucket,
					payouts,
					payout,
					costFactor: payout,
					message: `Landed in slot ${bucket + 1}`,
				},
				secret: [],
			};
		}
		case "roulette": {
			// Never substitute a bet: only settle the explicit chip placements sent by the UI.
			const bets = normalizeRouletteBets(config.bets, tokenStake);
			const totalChips = bets.reduce((sum, b) => sum + b.chips, 0);
			const number = draw(37);
			const returnedChips = bets.reduce(
				(sum, b) => sum + b.chips * rouletteReturn(b.bet, number),
				0,
			);
			// Unplaced chips remain at their original value; only placed chips carry risk.
			const payout = (tokenStake - totalChips + returnedChips) / tokenStake;
			const costFactor =
				(tokenStake -
					totalChips +
					bets.reduce(
						(sum, b) => sum + b.chips * rouletteCostMultiplier(b.bet, number),
						0,
					)) /
				tokenStake;
			return {
				public: {
					...base,
					kind: "roulette",
					bet: bets.length === 1 ? bets[0]!.bet : "multiple",
					bets,
					totalChips,
					returnedChips,
					chipUnit: "tokens",
					chipBudget: tokenStake,
					number,
					payout,
					costFactor,
					message: `Number ${number} · ${returnedChips.toLocaleString()} tokens returned`,
				},
				secret: [],
			};
		}
		case "mines": {
			const count = integer(config.count ?? 3, 1, 10);
			return {
				public: {
					...base,
					kind: "mines",
					phase: "active",
					payout: null,
					count,
					revealed: [],
					costFactor: minesCostMultiplier(count, 0),
					message: "Pick a tile or cash out",
				},
				secret: shuffled(25, draw).slice(0, count),
			};
		}
		case "blackjack": {
			const deck = shuffled(52, draw);
			const player = [deck.pop()!, deck.pop()!],
				dealer = [deck.pop()!, deck.pop()!];
			const state: PrivateGame = {
				public: {
					...base,
					kind: "blackjack",
					phase: "active",
					payout: null,
					player,
					dealer: [dealer[0]!, null],
					message: "Hit or stand",
				},
				secret: [...dealer, ...deck],
			};
			if (cardScore(player) === 21 || cardScore(dealer) === 21)
				finishBlackjack(state);
			return state;
		}
	}
}
function finishBlackjack(state: PrivateGame) {
	if (state.public.kind !== "blackjack") throw new Error("Invalid hand");
	const g = state.public;
	const dealer = state.secret.slice(0, 2),
		deck = state.secret.slice(2);
	const p = cardScore(g.player);
	const natural = g.player.length === 2 && p === 21;
	if (p <= 21 && !natural)
		while (cardScore(dealer) < 17) dealer.push(deck.pop()!);
	const d = cardScore(dealer),
		dealerNatural = dealer.length === 2 && d === 21;
	const payout =
		p > 21
			? 0
			: natural
				? dealerNatural
					? 1
					: 2.5
				: dealerNatural
					? 0
					: d > 21 || p > d
						? 2
						: p === d
							? 1
							: 0;
	state.public = {
		...g,
		dealer,
		phase: "complete",
		payout,
		costFactor: payout > 1 ? 0 : payout === 1 ? 1 : 2,
		message:
			payout === 2.5
				? "Blackjack!"
				: payout === 1
					? "Push"
					: payout > 1
						? "You win"
						: p > 21
							? "Bust"
							: "Dealer wins",
	};
	state.secret = [];
}
export function advanceGame(
	state: PrivateGame,
	request: GameRequest,
): PrivateGame {
	const g = state.public;
	if (g.phase !== "active" || request.game !== g.kind)
		throw new Error("This game cannot accept that action");
	if (g.kind === "mines") {
		if (request.action === "cashout") {
			state.public = {
				...g,
				phase: "complete",
				payout: minesPayout(g.count, g.revealed.length),
				costFactor: minesCostMultiplier(g.count, g.revealed.length),
				mines: state.secret,
				message: "Cashed out",
			};
		} else if (request.action === "pick") {
			const index = integer(request.index, 0, 24);
			if (g.revealed.includes(index)) throw new Error("Tile already revealed");
			if (state.secret.includes(index))
				state.public = {
					...g,
					phase: "complete",
					payout: 0,
					costFactor: 2,
					mines: state.secret,
					hit: index,
					message: "Mine hit",
				};
			else {
				const revealed = [...g.revealed, index],
					complete = revealed.length === 25 - g.count;
				state.public = {
					...g,
					revealed,
					phase: complete ? "complete" : "active",
					payout: complete ? minesPayout(g.count, revealed.length) : null,
					costFactor: minesCostMultiplier(g.count, revealed.length),
					mines: complete ? state.secret : undefined,
					message: complete
						? "All gems found"
						: "Gem found · keep going or cash out",
				};
			}
		} else throw new Error("Invalid Mines action");
	} else if (g.kind === "blackjack") {
		if (request.action === "stand") finishBlackjack(state);
		else if (request.action === "hit") {
			g.player.push(state.secret.pop()!);
			if (cardScore(g.player) >= 21) finishBlackjack(state);
		} else throw new Error("Invalid Blackjack action");
	} else throw new Error("Game already finished");
	state.public.revision = g.revision + 1;
	return state;
}
