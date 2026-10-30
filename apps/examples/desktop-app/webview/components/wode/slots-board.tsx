"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { PublicGame } from "../../../sidecar/wode/game-types";
import { SLOT_SYMBOLS } from "../../../sidecar/wode/slots";

type SlotState = Extract<PublicGame, { kind: "slots" }>;

export function SlotsBoard({
	state,
	busy,
	animating,
	disabled,
	onSpin,
}: {
	state?: SlotState;
	busy: boolean;
	animating: boolean;
	disabled: boolean;
	onSpin: () => void;
}) {
	const [pull, setPull] = useState(0);
	const drag = useRef<{ id: number; y: number } | null>(null);
	const distance = useRef(0);
	function release(e: PointerEvent<HTMLButtonElement>, cancelled = false) {
		if (drag.current?.id !== e.pointerId) return;
		const shouldSpin = !cancelled && distance.current >= 60 && !disabled;
		drag.current = null;
		distance.current = 0;
		setPull(0);
		if (e.currentTarget.hasPointerCapture(e.pointerId))
			e.currentTarget.releasePointerCapture(e.pointerId);
		if (shouldSpin) onSpin();
	}
	return (
		<div className="rc-slots" data-spinning={busy}>
			<div className="rc-slots-machine">
				<div className="rc-slots-cabinet">
					<div
						className="rc-slots-reels"
						aria-label={
							busy
								? "Reels spinning"
								: state
									? state.reels.map((n) => SLOT_SYMBOLS[n]!.label).join(", ")
									: "Three slot reels"
						}
					>
						{[0, 1, 2].map((column) => {
							const symbol = state?.reels[column] ?? column;
							const stop = state ? 24 + column * 8 + symbol : symbol;
							return (
								<div className="rc-slot-window" key={column} aria-hidden="true">
									<div
										key={`${state?.revision ?? "ready"}:${column}`}
										className={`rc-slot-strip${busy && !state ? " rc-slot-loop" : ""}${animating && state ? " rc-slot-settle" : ""}`}
										style={
											{
												"--stop": stop,
												"--reel-time": `${0.65 + column * 0.15}s`,
												"--reel-delay": `${column * -0.14}s`,
											} as CSSProperties
										}
									>
										{Array.from({ length: 48 }, (_, i) => (
											<div className="rc-slot-symbol" key={i}>
												<img
													src={`/app-icons/${SLOT_SYMBOLS[i % SLOT_SYMBOLS.length]!.id}.png`}
													alt=""
													draggable={false}
												/>
											</div>
										))}
									</div>
								</div>
							);
						})}
					</div>
					<div className="rc-slots-label">
						<span>✦</span>{" "}
						{busy ? "Feeling lucky…" : "Tokens are expensive. Feeling lucky?"}{" "}
						<span>✦</span>
					</div>
				</div>
				<div className="rc-slot-lever-rail">
					<div className="rc-slot-lever-base" aria-hidden="true" />
					<button
						type="button"
						className="rc-slot-lever"
						aria-label="Pull lever down to spin. Press Enter or Space to spin."
						disabled={disabled}
						style={{ "--pull": `${pull}px` } as CSSProperties}
						onPointerDown={(e) => {
							if (disabled || (e.pointerType === "mouse" && e.button !== 0))
								return;
							drag.current = { id: e.pointerId, y: e.clientY };
							e.currentTarget.setPointerCapture(e.pointerId);
						}}
						onPointerMove={(e) => {
							if (drag.current?.id !== e.pointerId) return;
							distance.current = Math.max(
								0,
								Math.min(90, e.clientY - drag.current.y),
							);
							setPull(distance.current);
						}}
						onPointerUp={(e) => release(e)}
						onPointerCancel={(e) => release(e, true)}
						onLostPointerCapture={() => {
							drag.current = null;
							distance.current = 0;
							setPull(0);
						}}
						onClick={(e) => {
							if (e.detail === 0 && !disabled) onSpin();
						}}
					>
						<span className="rc-slot-lever-shaft" />
						<span className="rc-slot-lever-ball" />
					</button>
					<span className="rc-slot-pull-hint">
						{pull >= 60 ? "Release!" : "Pull ↓"}
					</span>
				</div>
			</div>
			<div className="rc-slots-paytable" aria-label="Token cost multipliers">
				<span>
					<b>3 jackpots</b>
					<strong>FREE</strong>
					<small>1 in 64</small>
				</span>
				<span>
					<b>3 matching</b>
					<strong>0.25×</strong>
					<small>3 in 64</small>
				</span>
				<span>
					<b>Any pair</b>
					<strong>0.5×</strong>
					<small>36 in 64</small>
				</span>
				<span>
					<b>No match</b>
					<strong>2×</strong>
					<small>24 in 64</small>
				</span>
			</div>
			<p className="rc-slot-hint">
				{disabled
					? busy
						? "Reels stop one at a time. Your result is saved."
						: "Play again to pull the lever with your updated tokens."
					: "Drag the red lever down and release, or press Spin reels below."}
			</p>
		</div>
	);
}
