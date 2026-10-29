import { creditAmount } from "../../../sidecar/rollcode/demo-wallet";
import type { Roll, RoundHistory } from "../../../sidecar/rollcode/ledger";
import { games } from "./game-picker";
import { GameIcon } from "./game-icon";

export function getRoundHistory(roll: Roll): RoundHistory[] {
	return (
		roll.rounds ??
		(roll.multiplier !== null
			? [
					{
						id: `previous:${roll.id}`,
						startedAt: roll.completedAt,
						completedAt: roll.completedAt,
						stakeTokens: roll.tokens,
						resultTokens: roll.simulatedTokens ?? roll.tokens * roll.multiplier,
						multiplier: roll.multiplier,
						game: roll.game?.phase === "complete" ? roll.game : undefined,
					},
				]
			: [])
	);
}

export function GameHistory({ roll }: { roll: Roll }) {
	const history = getRoundHistory(roll);
	if (!history.length) return null;
	return (
		<section
			className="rc-game-history"
			aria-label="Games played for this message"
		>
			<h4>
				History{" "}
				<span>
					{history.length} {history.length === 1 ? "game" : "games"}
				</span>
			</h4>
			<ol>
				{history
					.slice()
					.reverse()
					.map((round) => {
						const kind = round.game?.kind;
						const change =
							round.resultTokens < round.stakeTokens
								? "savings"
								: round.resultTokens > round.stakeTokens
									? "extra"
									: "unchanged";
						return (
							<li key={round.id} data-change={change}>
								{kind ? (
									<GameIcon game={kind} />
								) : (
									<span className="rc-history-legacy">🎲</span>
								)}
								<div>
									<span className="rc-history-name">
										{games.find((g) => g.id === kind)?.name ?? "Original roll"}
									</span>
									<span className="rc-history-tokens">
										{creditAmount(round.stakeTokens)}{" "}
										<span aria-hidden="true">→</span>{" "}
										<strong>{creditAmount(round.resultTokens)}</strong> credits
									</span>
								</div>
								<time
									dateTime={round.completedAt}
									title={new Date(round.completedAt).toLocaleString()}
								>
									{new Date(round.completedAt).toLocaleTimeString(undefined, {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</time>
							</li>
						);
					})}
			</ol>
		</section>
	);
}
