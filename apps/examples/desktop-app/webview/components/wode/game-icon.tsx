import type { GameId } from "./game-picker";

/** Small original illustrations, kept as vectors for crisp desktop scaling. */
export function GameIcon({ game }: { game: GameId }) {
	if (game === "slots")
		return (
			<img
				className="rc-game-icon"
				src="/app-icons/jackpot.png"
				alt=""
				aria-hidden="true"
				style={{ imageRendering: "pixelated", borderRadius: 8 }}
			/>
		);
	return (
		<svg
			className="rc-game-icon"
			viewBox="0 0 40 40"
			fill="none"
			aria-hidden="true"
		>
			{game === "blackjack" && (
				<>
					<rect
						x="6"
						y="8"
						width="21"
						height="28"
						rx="4"
						fill="#a7bfff"
						transform="rotate(-14 6 8)"
					/>
					<rect
						x="15"
						y="5"
						width="21"
						height="29"
						rx="4"
						fill="#fff0d9"
						stroke="#e0c49e"
					/>
					<path
						d="M25.5 12c-2 3-6 5-6 8a3.5 3.5 0 0 0 6 2.4A3.5 3.5 0 0 0 31.5 20c0-3-4-5-6-8Z"
						fill="#ec5573"
					/>
					<path d="m25.5 21-2.5 6h5l-2.5-6Z" fill="#ec5573" />
					<path d="m19 9 1 3h-2l1-3Z" fill="#ec5573" />
				</>
			)}
			{game === "dice" && (
				<>
					<rect
						x="4"
						y="5"
						width="23"
						height="23"
						rx="6"
						fill="#9972ef"
						transform="rotate(-10 4 5)"
					/>
					<circle cx="12" cy="12" r="2" fill="#eee3ff" />
					<rect
						x="13"
						y="14"
						width="23"
						height="23"
						rx="6"
						fill="#d3b1ff"
						stroke="#eedaff"
					/>
					{[
						[19, 20],
						[30, 20],
						[24.5, 25.5],
						[19, 31],
						[30, 31],
					].map(([cx, cy]) => (
						<circle key={`${cx}:${cy}`} cx={cx} cy={cy} r="2" fill="#65429d" />
					))}
				</>
			)}
			{game === "plinko" && (
				<>
					<path
						d="M20 5 37 33H3L20 5Z"
						fill="#214b65"
						stroke="#67d7ed"
						strokeWidth="1.5"
						strokeLinejoin="round"
					/>
					{[
						[20, 14],
						[15, 21],
						[25, 21],
						[10, 28],
						[20, 28],
						[30, 28],
					].map(([cx, cy]) => (
						<circle
							key={`${cx}:${cy}`}
							cx={cx}
							cy={cy}
							r="1.6"
							fill="#9ce8f7"
						/>
					))}
					<circle cx="23" cy="6" r="4" fill="#ffd16d" stroke="#fff0b7" />
					<path
						d="M5 35h8m3 0h8m3 0h8"
						stroke="#f2a869"
						strokeWidth="3"
						strokeLinecap="round"
					/>
				</>
			)}
			{game === "mines" && (
				<>
					<rect x="3" y="4" width="34" height="32" rx="7" fill="#254b43" />
					<path
						d="m20 8 11 10-11 14L9 18 20 8Z"
						fill="#63dfb4"
						stroke="#abffe0"
						strokeWidth="1.2"
					/>
					<path
						d="m9 18 11 3 11-3M20 8l-5 10 5 14 5-14-5-10Z"
						stroke="#269c80"
						strokeWidth="1.1"
					/>
					<path
						d="M32 5v6m-3-3h6"
						stroke="#f9df87"
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
				</>
			)}
			{game === "roulette" && (
				<>
					<circle
						cx="20"
						cy="20"
						r="17"
						fill="#312c32"
						stroke="#e5b96d"
						strokeWidth="2"
					/>
					{Array.from({ length: 12 }, (_, i) => (
						<path
							key={i}
							d="M20 6a14 14 0 0 1 7 1.88L24 13.07A8 8 0 0 0 20 12Z"
							fill={i === 0 ? "#65c799" : i % 2 ? "#ed6a78" : "#5a5260"}
							transform={`rotate(${i * 30} 20 20)`}
						/>
					))}
					<circle cx="20" cy="20" r="6" fill="#d9a65c" />
					<path
						d="M20 12v16m-8-8h16"
						stroke="#ffe1a3"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<circle cx="29" cy="10" r="2.3" fill="#fff4dc" />
				</>
			)}
		</svg>
	);
}
