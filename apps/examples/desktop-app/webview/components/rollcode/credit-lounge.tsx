"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Dice5, Search, X } from "lucide-react";
import { desktopClient } from "@/lib/desktop-client";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Roll } from "../../../sidecar/rollcode/ledger";
import { GameHistory, getRoundHistory } from "./game-history";
import { games } from "./game-picker";
import { useDemoWallet } from "./use-demo-wallet";
import { AutoGambaMonitor } from "./auto-gamba-monitor";
import { TokenChangeBurst, roundTokenChanges } from "./token-change-burst";
import {
	creditAmount,
	demoCredits,
} from "../../../sidecar/rollcode/demo-wallet";

const tokens = (value: number) =>
	value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const balance = (roll: Roll) =>
	roll.simulatedTokens ?? roll.tokens * (roll.multiplier ?? 1);
const change = (roll: Roll) =>
	balance(roll) < roll.tokens
		? "savings"
		: balance(roll) > roll.tokens
			? "extra"
			: "unchanged";
const label = (m: number | null) =>
	m === null
		? "Not played"
		: m === 0
			? "Free"
			: `${Number(m.toFixed(4))}× total cost`;
const dollars = (value: number) =>
	new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: value > 0 && value < 0.01 ? 6 : 2,
	}).format(value);

export function CreditLounge({
	collapsed = false,
	showAutoPlayers = true,
}: {
	collapsed?: boolean;
	showAutoPlayers?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const { wallet, error: walletError } = useDemoWallet();
	const [rolls, setRolls] = useState<Roll[]>([]);
	const [error, setError] = useState("");
	const initialized = useRef(false);
	const [filter, setFilter] = useState("all");
	const [search, setSearch] = useState("");
	const refresh = useCallback(async () => {
		try {
			setRolls(await desktopClient.invoke<Roll[]>("rollcode_list"));
			setError("");
			initialized.current = true;
		} catch {
			setError(
				"Usage history unavailable. Reconnect to the local backend to retry.",
			);
		}
	}, []);
	useEffect(() => {
		void refresh();
		const stop = desktopClient.subscribe("rollcode_roll", () => void refresh());
		const stopError = desktopClient.subscribe("rollcode_error", () =>
			setError(
				"Could not save a game. Check disk access and restart to recover.",
			),
		);
		const stopState = desktopClient.subscribeTransportState(() => {
			if (initialized.current) void refresh();
		});
		const interval = setInterval(() => void refresh(), 15000);
		const update = () => void refresh();
		window.addEventListener("rollcode-ledger-updated", update);
		return () => {
			window.removeEventListener("rollcode-ledger-updated", update);
			stop();
			stopError();
			stopState();
			clearInterval(interval);
		};
	}, [refresh]);
	const known = rolls.filter((r) => r.baseCost !== null);
	const base = known.reduce((s, r) => s + r.baseCost!, 0);
	const spent = known.reduce((s, r) => s + (r.simulatedCost ?? r.baseCost!), 0);
	const actualTokens = rolls.reduce((s, r) => s + r.tokens, 0);
	const simulatedTokens = rolls.reduce((s, r) => s + balance(r), 0);
	const savings = actualTokens - simulatedTokens;
	const rounds = rolls.flatMap(getRoundHistory);
	const freeTasks = rolls.filter((r) => r.multiplier === 0).length;
	const visibleRolls = rolls.filter((r) => {
		const matchesFilter =
			filter === "all" ||
			(filter === "savings" && change(r) === "savings") ||
			(filter === "extra" && change(r) === "extra") ||
			(filter === "free" && r.multiplier === 0);
		const query = search.trim().toLowerCase();
		return (
			matchesFilter &&
			(!query ||
				[
					r.sessionId,
					label(r.multiplier),
					r.game?.kind ?? "",
					...getRoundHistory(r).map(
						(round) =>
							games.find((g) => g.id === round.game?.kind)?.name ??
							"Original roll",
					),
					new Date(r.completedAt).toLocaleString(),
				].some((value) => value.toLowerCase().includes(query)))
		);
	});
	function exportHistory() {
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(rolls, null, 2)], { type: "application/json" }),
		);
		const a = document.createElement("a");
		a.href = url;
		a.download = "rollcode-ledger.json";
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
	return (
		<>
			<button
				type="button"
				className={`rc-demo-counter${collapsed ? " rc-demo-counter-collapsed" : ""}`}
				onClick={() => setOpen(true)}
				title={
					wallet
						? `${demoCredits(wallet.balanceTokens)} · ${tokens(wallet.balanceTokens)} tokens remaining`
						: walletError || "Loading balance"
				}
				aria-label={
					wallet
						? `Balance: ${demoCredits(wallet.balanceTokens)}, equivalent to ${tokens(wallet.balanceTokens)} tokens. Open usage.`
						: "Balance loading. Open usage."
				}
			>
				<span className="rc-demo-counter-label">
					{collapsed ? "CR" : "Balance"}
				</span>
				<strong>
					{wallet ? creditAmount(wallet.balanceTokens) : "—"}
					{!collapsed && <small> credits</small>}
					{collapsed && (
						<TokenChangeBurst
							events={roundTokenChanges(rolls)}
							ready={initialized.current}
						/>
					)}
				</strong>
				{!collapsed && (
					<span className="rc-demo-counter-tokens">
						{wallet
							? `${tokens(wallet.balanceTokens)} tokens remaining`
							: walletError
								? "Restart backend to connect"
								: "Loading…"}
						<TokenChangeBurst
							events={roundTokenChanges(rolls)}
							ready={initialized.current}
						/>
					</span>
				)}
			</button>
			<Button
				className={
					collapsed
						? "rc-wallet min-w-0 size-9 justify-center px-0"
						: "rc-wallet min-w-0 justify-start"
				}
				variant="sidebarItem"
				onClick={() => {
					setOpen(true);
					void refresh();
				}}
				type="button"
				aria-label="Open usage dashboard"
				title="Usage"
			>
				<Dice5 className="size-4" />
				{!collapsed ? "Usage" : null}
			</Button>
			<AutoGambaMonitor visible={showAutoPlayers && !open} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="rc-lounge">
					<header className="rc-topbar">
						<div className="rc-wordmark">
							<span className="rc-appmark">
								<Dice5 size={19} />
							</span>
							rollcode<span className="rc-brand-dot">.</span>
						</div>
						<span className="rc-local">Stored on this device</span>
					</header>
					<div className="rc-page-heading">
						<DialogTitle className="rc-title">Usage</DialogTitle>
						<DialogDescription className="rc-description">
							Actual token usage and adjusted game costs, side by side.
						</DialogDescription>
					</div>
					{error && (
						<p role="alert" className="rc-error">
							{error}{" "}
							<button type="button" onClick={() => void refresh()}>
								Retry
							</button>
						</p>
					)}
					<section className="rc-demo-wallet-panel" aria-label="Credit wallet">
						<div>
							<span>Balance</span>
							<strong>
								{wallet ? demoCredits(wallet.balanceTokens) : "Unavailable"}
							</strong>
							<small>
								{wallet ? tokens(wallet.balanceTokens) : "—"} tokens remaining ·
								1 credit = 1,000 tokens
							</small>
						</div>
						<p>
							Each response deducts its reported tokens in credits. Games refund
							or add the difference in cost. Existing saved responses are
							included. Credits have no cash value.
						</p>
						{wallet && wallet.balanceTokens < 0 && (
							<p className="rc-demo-overdrawn">
								Balance is below zero. Actual API usage is unaffected.
							</p>
						)}
						{walletError && <p role="alert">{walletError}</p>}
					</section>
					<div className="rc-stats">
						<Stat
							name="Actual tokens"
							value={tokens(actualTokens)}
							detail={`${rolls.length} completed responses · input + output`}
						/>
						<Stat
							name="Credits spent"
							value={creditAmount(simulatedTokens)}
							detail="Latest cost per response, including unplayed responses"
						/>
						<Stat
							name={savings >= 0 ? "Credits saved" : "Extra credits"}
							value={creditAmount(Math.abs(savings))}
							change={
								savings > 0 ? "savings" : savings < 0 ? "extra" : "unchanged"
							}
							detail="Compared with actual tokens · API billing unchanged"
						/>
						<Stat
							name="Games played"
							value={tokens(rounds.length)}
							detail={`${freeTasks} free ${freeTasks === 1 ? "response" : "responses"} · ${rolls.filter((r) => r.game?.phase === "active").length} in progress`}
						/>
					</div>
					<div className="rc-usage-estimates">
						<span>
							Estimated API cost{" "}
							<strong>{known.length ? dollars(base) : "Unavailable"}</strong>
						</span>
						<span>
							Adjusted cost estimate{" "}
							<strong>{known.length ? dollars(spent) : "Unavailable"}</strong>
						</span>
						<small>
							USD estimates for {known.length} of {rolls.length} responses.
							Tokens have no fixed dollar conversion; pricing depends on the
							model and token type.
						</small>
					</div>
					<section
						className="rc-roll-section"
						aria-labelledby="rc-history-heading"
					>
						<div className="rc-section-heading">
							<div>
								<h3 id="rc-history-heading">Response history</h3>
								<p>
									{rolls.length} responses · {rounds.length} completed games
								</p>
							</div>
							<button
								className="rc-export"
								type="button"
								onClick={exportHistory}
							>
								<ArrowDownToLine size={14} />
								Export history
							</button>
						</div>
						<div className="rc-controls">
							<label className="rc-search">
								<Search size={15} />
								<input
									aria-label="Search response history"
									placeholder="Search history"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
								/>
								{search && (
									<button
										type="button"
										aria-label="Clear search"
										onClick={() => setSearch("")}
									>
										<X size={13} />
									</button>
								)}
							</label>
							<fieldset
								className="rc-filters"
								aria-label="Filter response history"
							>
								{[
									["all", "All"],
									["savings", "Reduced"],
									["extra", "Increased"],
									["free", "Free"],
								].map(([value, text]) => (
									<button
										key={value}
										type="button"
										aria-pressed={filter === value}
										onClick={() => setFilter(value)}
									>
										{text}
									</button>
								))}
							</fieldset>
						</div>
						<div className="rc-history">
							{!visibleRolls.length ? (
								<div className="rc-empty">
									<span className="rc-empty-icon">
										<Dice5 size={22} />
									</span>
									<h4>
										{rolls.length ? "No matching responses" : "No usage yet"}
									</h4>
									<p>
										{rolls.length
											? "Try another search or filter."
											: "Complete your first task to start your history."}
									</p>
									{!!rolls.length && (
										<button
											type="button"
											onClick={() => {
												setSearch("");
												setFilter("all");
											}}
										>
											Clear filters
										</button>
									)}
								</div>
							) : (
								<table>
									<thead>
										<tr>
											<th>Response</th>
											<th>Actual tokens</th>
											<th>Cost (credits)</th>
											<th>Total change</th>
											<th>Games</th>
										</tr>
									</thead>
									<tbody>
										{visibleRolls.map((r) => (
											<tr key={r.id}>
												<td>
													<span className="rc-task-id" title={r.sessionId}>
														{r.sessionId}
													</span>
													<span className="rc-task-date">
														{new Date(r.completedAt).toLocaleString()}
													</span>
												</td>
												<td>{tokens(r.tokens)}</td>
												<td>
													<span
														className="rc-usage-result"
														data-change={change(r)}
													>
														{r.multiplier !== null &&
															balance(r) !== r.tokens && (
																<s>{creditAmount(r.tokens)}</s>
															)}
														<strong>{creditAmount(balance(r))}</strong>
													</span>
												</td>
												<td>
													<span className="rc-badge" data-change={change(r)}>
														{label(r.multiplier)}
													</span>
													{r.game?.phase === "active" && (
														<span className="rc-task-date">
															Game in progress
														</span>
													)}
												</td>
												<td>
													{getRoundHistory(r).length ? (
														<details className="rc-usage-rounds">
															<summary>
																{getRoundHistory(r).length}{" "}
																{getRoundHistory(r).length === 1
																	? "game"
																	: "games"}
															</summary>
															<GameHistory roll={r} />
														</details>
													) : (
														<span className="rc-task-date">
															{r.game?.phase === "active"
																? "First game in progress"
																: "Not played"}
														</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</section>
					<section
						className="rc-odds-section"
						aria-label="Game settlement rules"
					>
						<div className="rc-section-heading">
							<h3>How games work</h3>
							<span>Replay using your updated tokens</span>
						</div>
						<div className="rc-odds">
							{[
								["Blackjack", "Win = free · tie 1× · loss 2×"],
								["Dice", "Choose a target · missing costs 2×"],
								["Plinko", "Free 0× edges · highest cost in the center"],
								["Mines", "Starts at 2× · safe gems reduce the cost"],
								["Roulette", "Token chips · stack bets across the board"],
								["Slots", "Pull the lever · three Jackpots = free"],
							].map(([name, rule]) => (
								<div key={name}>
									<span>{name}</span>
									<small>{rule}</small>
								</div>
							))}
						</div>
						<p className="rc-footnote">
							New token cost = staked tokens × cost multiplier. 1.4× increases
							cost by 40%, 0.5× halves it, and 0× is free. Each new game uses
							the previous result as its stake, so multipliers compound.
							Roulette settles each placement separately; unplaced tokens stay
							unchanged.
						</p>
					</section>
					<p className="rc-disclaimer">
						Credits have no cash value. Actual API tokens and charges stay
						unchanged. Expand a response’s games to see every saved result.
						Cached input is already included in input tokens.
					</p>
					{known.length !== rolls.length && (
						<p className="rc-footnote">
							{rolls.length - known.length} responses have no dollar estimate.
							Their tokens and games are still included above.
						</p>
					)}
					<footer className="rc-footer">
						<span>
							Powered by{" "}
							<a
								href="https://github.com/cline/cline"
								target="_blank"
								rel="noreferrer"
							>
								Cline
							</a>{" "}
							· Apache 2.0
						</span>
						<span>All data stays local</span>
					</footer>
				</DialogContent>
			</Dialog>
		</>
	);
}

function Stat({
	name,
	value,
	detail,
	change,
}: {
	name: string;
	value: string;
	detail: string;
	change?: string;
}) {
	return (
		<div className="rc-stat" data-change={change}>
			<span>{name}</span>
			<strong>{value}</strong>
			<small>{detail}</small>
		</div>
	);
}
