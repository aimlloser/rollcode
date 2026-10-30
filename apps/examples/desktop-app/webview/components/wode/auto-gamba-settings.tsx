"use client";
import { useEffect, useState } from "react";
import { Switch } from "@cline/ui";
import { useAutoGamba } from "./use-auto-gamba";
import type { AutoStopMode } from "../../../sidecar/wode/auto-rules";

export function AutoGambaSettings() {
	const { state, error, saving, setEnabled, setRule } = useAutoGamba();
	const [percent, setPercent] = useState("50");
	const [fieldError, setFieldError] = useState("");
	const savedPercent = state?.targetPercent;
	useEffect(() => {
		if (savedPercent !== undefined) setPercent(String(savedPercent));
	}, [savedPercent]);
	const valid =
		Number.isFinite(Number(percent)) &&
		Number(percent) >= 1 &&
		Number(percent) <= 100;
	const savePercent = () => {
		if (!state) return;
		if (!valid) {
			setFieldError("Enter a percentage from 1 to 100.");
			return;
		}
		setFieldError("");
		if (Number(percent) !== state.targetPercent)
			void setRule(state.mode, Number(percent));
	};
	const selectMode = (mode: AutoStopMode) => {
		if (!state) return;
		setFieldError("");
		void setRule(mode, valid ? Number(percent) : state.targetPercent);
	};
	return (
		<section className="border-b py-4" aria-labelledby="rc-auto-setting">
			<div className="flex items-center justify-between gap-5">
				<div className="flex flex-col gap-1">
					<h3
						id="rc-auto-setting"
						className="text-base font-semibold text-foreground"
					>
						Auto Gamba
					</h3>
					<p className="max-w-lg text-sm text-muted-foreground">
						Play random games on each new completed response until your chosen
						token target is reached.
					</p>
				</div>
				<Switch
					aria-label="Auto Gamba"
					checked={state?.enabled ?? false}
					disabled={!state || saving}
					onCheckedChange={(enabled) => void setEnabled(enabled)}
				/>
			</div>
			{state?.enabled && (
				<fieldset className="rc-auto-stop-rules" disabled={saving}>
					<legend>Stop when</legend>
					<label className="rc-auto-rule-option">
						<input
							type="radio"
							name="auto-gamba-stop-rule"
							checked={state.mode === "all-or-nothing"}
							onChange={() => selectMode("all-or-nothing")}
						/>
						<span>
							<b>All or nothing</b>
							<small>Keep playing until the token cost is free.</small>
						</span>
					</label>
					<label className="rc-auto-rule-option">
						<input
							type="radio"
							name="auto-gamba-stop-rule"
							checked={state.mode === "percent"}
							onChange={() => selectMode("percent")}
						/>
						<span>
							<b>Percent wins</b>
							<small>
								Stop at your chosen reduction from the original token cost.
							</small>
						</span>
					</label>
					{state.mode === "percent" && (
						<div className="rc-auto-percent">
							<label htmlFor="rc-auto-percent">Token reduction</label>
							<div>
								<input
									id="rc-auto-percent"
									type="number"
									min={1}
									max={100}
									step="0.1"
									value={percent}
									aria-invalid={!!fieldError}
									aria-describedby="rc-auto-percent-help"
									onChange={(e) => {
										setPercent(e.target.value);
										setFieldError("");
									}}
									onBlur={savePercent}
									onKeyDown={(e) => {
										if (e.key === "Enter") e.currentTarget.blur();
									}}
								/>
								<span>%</span>
							</div>
							<p id="rc-auto-percent-help">
								{fieldError ||
									(valid
										? `A 10,000-token response stops at ${Number((10000 * (1 - Number(percent) / 100)).toFixed(2)).toLocaleString()} tokens or below. Saves when you leave the box or press Enter.`
										: "Enter 1–100. A higher percentage means a lower token target.")}
							</p>
						</div>
					)}
					<p className="rc-auto-rule-note">
						Applies to new responses. Active runs keep their saved goal.
					</p>
				</fieldset>
			)}
			<p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
				Uses the latest token stake each round. Costs can increase before a win.
				Each response plays independently; Cancel stops only that run. Turning
				Auto Gamba off stops all runs. Actual API charges stay unchanged.
			</p>
			{error && (
				<p className="mt-2 text-xs text-destructive" role="alert">
					{error}
				</p>
			)}
		</section>
	);
}
