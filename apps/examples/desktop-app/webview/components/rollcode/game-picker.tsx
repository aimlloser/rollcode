import { GameIcon } from "./game-icon";

export const games = [
	{ id: "blackjack", name: "Blackjack" },
	{ id: "dice", name: "Dice" },
	{ id: "plinko", name: "Plinko" },
	{ id: "mines", name: "Mines" },
	{ id: "roulette", name: "Roulette" },
	{ id: "slots", name: "Slots" },
] as const;

export type { GameId } from "../../../sidecar/rollcode/game-types";
import type { GameId } from "../../../sidecar/rollcode/game-types";

export function GamePicker({
	selected,
	onSelect,
}: {
	selected: GameId;
	onSelect: (game: GameId) => void;
}) {
	return (
		<div className="rc-game-picker" role="group" aria-label="Choose a game">
			{games.map(({ id, name }) => (
				<button
					key={id}
					type="button"
					aria-pressed={selected === id}
					className="rc-game-option"
					onClick={() => onSelect(id)}
				>
					<GameIcon game={id} />
					<span>{name}</span>
				</button>
			))}
		</div>
	);
}
