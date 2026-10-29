import { useId, type CSSProperties } from "react";

const RANKS = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
];
const SUITS = ["♠", "♥", "♣", "♦"];
const PIPS: Record<number, [number, number][]> = {
	1: [[50, 50]],
	2: [
		[50, 10],
		[50, 90],
	],
	3: [
		[50, 10],
		[50, 50],
		[50, 90],
	],
	4: [
		[15, 10],
		[85, 10],
		[15, 90],
		[85, 90],
	],
	5: [
		[15, 10],
		[85, 10],
		[50, 50],
		[15, 90],
		[85, 90],
	],
	6: [
		[15, 10],
		[85, 10],
		[15, 50],
		[85, 50],
		[15, 90],
		[85, 90],
	],
	7: [
		[15, 10],
		[85, 10],
		[50, 30],
		[15, 50],
		[85, 50],
		[15, 90],
		[85, 90],
	],
	8: [
		[15, 10],
		[85, 10],
		[50, 30],
		[15, 50],
		[85, 50],
		[50, 70],
		[15, 90],
		[85, 90],
	],
	9: [
		[15, 10],
		[85, 10],
		[15, 36],
		[85, 36],
		[50, 50],
		[15, 64],
		[85, 64],
		[15, 90],
		[85, 90],
	],
	10: [
		[15, 10],
		[85, 10],
		[50, 23],
		[15, 36],
		[85, 36],
		[15, 64],
		[85, 64],
		[50, 77],
		[15, 90],
		[85, 90],
	],
};

export function PlayingCard({
	value,
	delay = 0,
}: {
	value: number | null;
	delay?: number;
}) {
	const rank = value === null ? 0 : (value % 13) + 1,
		suit = value === null ? 0 : Math.floor(value / 13);
	const corner = (
		<>
			{RANKS[rank - 1]}
			<span>{SUITS[suit]}</span>
		</>
	);
	return (
		<div
			className={`rc-playing-card${value === null ? " rc-card-back" : ""}${suit % 2 ? " rc-red-card" : ""}`}
			style={{ "--deal-delay": `${delay}ms` } as CSSProperties}
			role="img"
			aria-label={
				value === null
					? "Face-down playing card"
					: `${RANKS[rank - 1]} of ${["spades", "hearts", "clubs", "diamonds"][suit]}`
			}
		>
			{value === null ? (
				<CardBack />
			) : (
				<>
					<small className="rc-card-corner">{corner}</small>
					<small className="rc-card-corner rc-card-corner-bottom">
						{corner}
					</small>
					{rank <= 10 ? (
						<div
							className={`rc-card-pips${rank === 1 ? " rc-card-ace" : ""}`}
							aria-hidden="true"
						>
							{PIPS[rank]!.map(([x, y], i) => (
								<span
									key={i}
									style={{
										left: `${x}%`,
										top: `${y}%`,
										transform: `translate(-50%,-50%)${y > 50 ? " rotate(180deg)" : ""}`,
									}}
								>
									{SUITS[suit]}
								</span>
							))}
						</div>
					) : (
						<div className="rc-card-court" aria-hidden="true">
							<span>{rank === 13 ? "♚" : rank === 12 ? "♛" : "♜"}</span>
							<span>{SUITS[suit]}</span>
							<span className="rc-court-mirror">
								{rank === 13 ? "♚" : rank === 12 ? "♛" : "♜"}
							</span>
						</div>
					)}
				</>
			)}
		</div>
	);
}

function CardBack() {
	const pattern = useId().replace(/:/g, "");
	return (
		<svg
			className="rc-card-print"
			viewBox="0 0 72 100"
			fill="none"
			aria-hidden="true"
		>
			<defs>
				<pattern
					id={pattern}
					width="6"
					height="6"
					patternUnits="userSpaceOnUse"
				>
					<path d="m3 0 3 3-3 3-3-3Z" stroke="#d3dbe9" strokeWidth=".45" />
					<circle cx="3" cy="3" r=".6" fill="#d3dbe9" />
				</pattern>
			</defs>
			<rect x="4" y="4" width="64" height="92" rx="3" fill="#263d63" />
			<rect
				x="7"
				y="7"
				width="58"
				height="86"
				rx="2"
				stroke="#eee5d1"
				strokeWidth=".7"
			/>
			<rect
				x="10"
				y="10"
				width="52"
				height="80"
				rx="1"
				fill={`url(#${pattern})`}
			/>
			<path
				d="M13 19v-6h6M53 13h6v6M59 81v6h-6M19 87h-6v-6"
				stroke="#eee5d1"
				strokeWidth="1.2"
			/>
			<path
				d="M36 12 59 50 36 88 13 50 36 12Z"
				fill="#263d63"
				stroke="#eee5d1"
				strokeWidth=".8"
			/>
			{[32, 68].map((y) => (
				<g key={y} transform={`translate(36 ${y})`}>
					<circle r="12" fill="#263d63" stroke="#eee5d1" strokeWidth=".6" />
					{Array.from({ length: 8 }, (_, i) => (
						<ellipse
							key={i}
							cx="0"
							cy="-5"
							rx="2.5"
							ry="5"
							stroke="#d3dbe9"
							strokeWidth=".55"
							transform={`rotate(${i * 45})`}
						/>
					))}
					<circle r="3" fill="#eee5d1" />
				</g>
			))}
			<path d="m36 42 6 8-6 8-6-8Z" stroke="#eee5d1" strokeWidth="1" />
		</svg>
	);
}
