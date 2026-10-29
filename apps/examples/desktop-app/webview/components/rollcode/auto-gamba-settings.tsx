"use client";
import { Switch } from "@cline/ui";
import { useAutoGamba } from "./use-auto-gamba";

export function AutoGambaSettings() {
	const { state, error, saving, setEnabled } = useAutoGamba();
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
						For each new completed response, play random games until its token
						cost is free.
					</p>
				</div>
				<Switch
					aria-label="Auto Gamba"
					checked={state?.enabled ?? false}
					disabled={!state || saving}
					onCheckedChange={(enabled) => void setEnabled(enabled)}
				/>
			</div>
			<p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
				Uses the latest token stake each round. Costs can increase before a win.
				Each response plays independently in its own mini player; cancel a run
				or turn this off at any time. Turning it off stops queued runs. An
				unfinished hand can be continued manually. Actual API charges stay
				unchanged.
			</p>
			{error && (
				<p className="mt-2 text-xs text-destructive" role="alert">
					{error}
				</p>
			)}
		</section>
	);
}
