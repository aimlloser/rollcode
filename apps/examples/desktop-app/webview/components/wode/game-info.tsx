import { Info } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { GameId } from "../../../sidecar/wode/game-types";

export function GameInfo({ kind, chance }: { kind: GameId; chance: number }) {
	const rules: Record<GameId, string> = {
		slots:
			"Pull the lever down and release, or use the Spin reels button. Each of the three reels independently picks one of four equally likely WODE icons using secure randomness. Three Jackpot icons make this task free (0×, 1/64 chance). Any other triple costs 0.25× (3/64); exactly one pair costs 0.5× (36/64); three different icons cost 2× (24/64). These are token-cost multipliers, not payout multipliers. Every spin uses the latest adjusted tokens and is saved exactly once. The reel animation reveals the saved result; it does not change the outcome.",
		blackjack:
			"All-or-nothing token cost: any win, including blackjack, makes the staked tokens free (0×). A loss doubles the cost (2×); a push leaves it unchanged (1×). One shuffled deck; dealer stands on all 17s. No insurance, split or double.",
		dice: `Your win chance is ${chance}%. Hitting the target gives a ${(chance / 99).toFixed(4)}× token-cost multiplier; missing it costs 2×. Over wins at or above the target; under wins below it. Rolls range from 0.00 to 99.99.`,
		plinko:
			"Slot labels are direct token-cost multipliers. Landing on 1.4× makes the new cost 140% of the stake; 0.5× halves it. Both outermost slots are 0× — Free, setting the adjusted token cost to zero. Center slots have the highest costs (2× low risk, 2.5× medium, 3× high). Each peg row independently sends the ball left or right with equal probability.",
		mines:
			"The cost multiplier starts at 2× and decreases after each safe gem. It equals 2 × the probability of surviving that many picks on this board. Cashing out applies the displayed multiplier directly to the stake. Hitting a mine costs 2×. Finding every gem automatically cashes out. The board is fixed when the game starts.",
		roulette:
			"Chips represent tokens. A winning number applies a 1/36× cost multiplier to those tokens; a winning dozen applies 1/3×; red and black pay 1:1 profit: a winning placement reduces the adjusted cost by the full staked amount (1,000 tokens staked saves 1,000). Other winning outside bets apply 0.5×. Losing bets cost 2×, including outside bets when zero lands. Unplaced tokens remain at 1×. The costs of all placements plus unplaced tokens are added to get the new balance.",
	};
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="rc-game-info-button"
					aria-label="Game rules and calculations"
					title="Rules and calculations"
				>
					<Info size={16} />
				</button>
			</PopoverTrigger>
			<PopoverContent className="rc-game-info" align="end" sideOffset={10}>
				<h3>Rules &amp; calculations</h3>
				<p>{rules[kind]}</p>
				<h4>Token cost</h4>
				<p className="rc-game-formula">
					new token cost = staked tokens × cost multiplier
				</p>
				<p>
					Every displayed cost multiplier is literal: above 1× increases token
					cost, below 1× decreases it, and 1× is unchanged. Green means savings;
					red means extra cost. Previously saved outcomes retain their original
					results.
				</p>
				<p>
					One credit represents 1,000 tokens. Responses deduct credits from your
					local wallet; games refund or add the change in cost. The first stake
					starts at reported input + output tokens, with cached input already
					included. Each new game uses the latest adjusted token balance. Every
					game is saved once in this message’s history. Actual API usage and
					charges stay unchanged.
				</p>
			</PopoverContent>
		</Popover>
	);
}
