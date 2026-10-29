"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { desktopClient } from "@/lib/desktop-client";
import type { DemoWallet } from "../../../sidecar/rollcode/demo-wallet";

export function useDemoWallet() {
	const [wallet, setWallet] = useState<DemoWallet | null>(null);
	const [error, setError] = useState("");
	const [resetting, setResetting] = useState(false);
	const resetRequest = useRef<string | null>(null);
	const resettingRef = useRef(false);
	const refresh = useCallback(async () => {
		try {
			const value = await desktopClient.invoke<DemoWallet>("rollcode_wallet");
			if (!value || !Number.isFinite(value.balanceTokens))
				throw new Error("Wallet unavailable");
			setWallet(value);
			setError("");
		} catch {
			setError(
				"Demo balance unavailable. Restart the backend to load the demo wallet.",
			);
		}
	}, []);
	useEffect(() => {
		void refresh();
		const stopRoll = desktopClient.subscribe(
			"rollcode_roll",
			() => void refresh(),
		);
		const stopWallet = desktopClient.subscribe(
			"rollcode_wallet",
			() => void refresh(),
		);
		const stopState = desktopClient.subscribeTransportState(
			() => void refresh(),
		);
		const onUpdate = () => void refresh();
		window.addEventListener("rollcode-ledger-updated", onUpdate);
		const interval = setInterval(onUpdate, 15000);
		return () => {
			stopRoll();
			stopWallet();
			stopState();
			clearInterval(interval);
			window.removeEventListener("rollcode-ledger-updated", onUpdate);
		};
	}, [refresh]);
	const reset = useCallback(async () => {
		if (resettingRef.current) return;
		resettingRef.current = true;
		setResetting(true);
		resetRequest.current ??= crypto.randomUUID();
		try {
			const value = await desktopClient.invoke<DemoWallet>(
				"rollcode_reset_wallet",
				{ requestId: resetRequest.current },
			);
			if (!value || !Number.isFinite(value.balanceTokens))
				throw new Error("Reset unavailable");
			setWallet(value);
			setError("");
			resetRequest.current = null;
			window.dispatchEvent(new Event("rollcode-ledger-updated"));
		} catch {
			setError(
				"Could not confirm the reset. Retry to recover the same reset safely.",
			);
		} finally {
			resettingRef.current = false;
			setResetting(false);
		}
	}, []);
	return { wallet, error, resetting, reset };
}
