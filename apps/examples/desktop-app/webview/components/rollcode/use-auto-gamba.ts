"use client";
import { useCallback, useEffect, useState } from "react";
import { desktopClient } from "@/lib/desktop-client";
import type { AutoGambaSnapshot } from "../../../sidecar/rollcode/auto-gamba";
import type { AutoStopMode } from "../../../sidecar/rollcode/auto-rules";

export function useAutoGamba() {
	const [state, setState] = useState<AutoGambaSnapshot | null>(null);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const refresh = useCallback(async () => {
		try {
			const value =
				await desktopClient.invoke<AutoGambaSnapshot>("rollcode_auto");
			if (
				!value ||
				typeof value.enabled !== "boolean" ||
				(value.mode !== "all-or-nothing" && value.mode !== "percent") ||
				!Number.isFinite(value.targetPercent) ||
				!Array.isArray(value.jobs)
			)
				throw new Error("Unavailable");
			setState(value);
			setError("");
		} catch {
			setError("Restart the backend to load Auto Gamba.");
		}
	}, []);
	useEffect(() => {
		void refresh();
		const stops = [
			desktopClient.subscribe("rollcode_auto", () => void refresh()),
			desktopClient.subscribe("rollcode_roll", () => void refresh()),
			desktopClient.subscribeTransportState(() => void refresh()),
		];
		const interval = setInterval(() => void refresh(), 3000);
		return () => {
			stops.forEach((stop) => stop());
			clearInterval(interval);
		};
	}, [refresh]);
	const change = useCallback(
		async (command: string, args: Record<string, unknown>) => {
			setSaving(true);
			try {
				setState(await desktopClient.invoke<AutoGambaSnapshot>(command, args));
				setError("");
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Could not save Auto Gamba setting.",
				);
			} finally {
				setSaving(false);
			}
		},
		[],
	);
	return {
		state,
		error,
		saving,
		setEnabled: (enabled: boolean) =>
			change("rollcode_auto_setting", { enabled }),
		setRule: (mode: AutoStopMode, targetPercent: number) =>
			change("rollcode_auto_rule", { mode, targetPercent }),
		stop: (id: string) => change("rollcode_auto_stop", { id }),
	};
}
