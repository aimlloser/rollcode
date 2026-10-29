// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { CreditLounge } from "./credit-lounge";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/desktop-client", () => ({
	desktopClient: {
		invoke,
		subscribe: () => () => {},
		subscribeTransportState: () => () => {},
	},
}));
let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	vi.useRealTimers();
	invoke.mockReset();
});

test("completed tasks never automatically open the dashboard or gamble", async () => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	invoke.mockResolvedValue([
		{
			id: "pending",
			sessionId: "task",
			completedAt: "2026-10-25T12:00:00Z",
			tokens: 1200,
			baseCost: 2,
			simulatedCost: 2,
			multiplier: null,
			acknowledged: false,
		},
	]);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	await act(async () => {
		root.render(<CreditLounge />);
	});
	expect(document.querySelector('[role="dialog"]')).toBeNull();
	expect(
		invoke.mock.calls.every(([command]) => command === "rollcode_list"),
	).toBe(true);
	await act(async () => {
		(
			document.querySelector(
				'[aria-label="Open simulated credit dashboard"]',
			) as HTMLButtonElement
		).click();
	});
	expect(document.body.textContent).toContain("Not rolled");
	expect(document.body.textContent).toContain(
		"Your API provider bills the normal amount",
	);
	expect(
		invoke.mock.calls.every(([command]) => command === "rollcode_list"),
	).toBe(true);
});

test("filters saved history without changing recorded outcomes", async () => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	invoke.mockResolvedValue(
		[0, 0.5, 2].map((multiplier, i) => ({
			id: String(i),
			sessionId: `task-${i}`,
			completedAt: "2026-10-25T12:00:00Z",
			tokens: 100,
			baseCost: 1,
			simulatedCost: multiplier,
			multiplier,
			acknowledged: true,
		})),
	);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	await act(async () => {
		root.render(<CreditLounge />);
	});
	await act(async () => {
		(
			document.querySelector(
				'[aria-label="Open simulated credit dashboard"]',
			) as HTMLButtonElement
		).click();
	});
	const clickFilter = async (text: string) =>
		act(async () => {
			(
				Array.from(document.querySelectorAll(".rc-filters button")).find(
					(button) => button.textContent === text,
				) as HTMLButtonElement
			).click();
		});
	expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
	await clickFilter("Savings");
	expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
	await clickFilter("Jackpots");
	expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
	await clickFilter("All");
	expect(document.querySelectorAll("tbody tr")).toHaveLength(3);
	expect(
		invoke.mock.calls.every(([command]) => command === "rollcode_list"),
	).toBe(true);
});
