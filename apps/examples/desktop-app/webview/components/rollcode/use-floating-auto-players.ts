"use client";
import { useEffect, useState } from "react";

type Box = { left: number; top: number; width: number; height: number };
export type AutoPlayerLayout = {
	positions: Record<string, Box>;
	stack: Box | null;
	ids: string[];
};
const EMPTY: AutoPlayerLayout = { positions: {}, stack: null, ids: [] };
const GAP = 8;
const MARGIN = 12;
const overlaps = (a: Box, b: Box) =>
	a.left < b.left + b.width + GAP &&
	a.left + a.width + GAP > b.left &&
	a.top < b.top + b.height + GAP &&
	a.top + a.height + GAP > b.top;

/** Float near the badges; use a scrollable floating stack if all full cards cannot fit. */
export function useFloatingAutoPlayers(ids: string[], enabled: boolean) {
	const [layout, setLayout] = useState<AutoPlayerLayout>(EMPTY);
	const key = ids.join("\n");
	useEffect(() => {
		if (!enabled || !key) {
			setLayout(EMPTY);
			return;
		}
		const selected = key.split("\n");
		let frame = 0;
		const observed = new Set<Element>();
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		const resize = new ResizeObserver(schedule);
		function measure() {
			frame = 0;
			const width = Math.min(280, window.innerWidth - MARGIN * 2);
			const maxHeight = window.innerHeight - MARGIN * 2;
			if (width <= 0 || maxHeight <= 0) return;
			const badges = Array.from(
				document.querySelectorAll<HTMLElement>(
					".rc-token-trigger[data-roll-id]",
				),
			);
			const panels = Array.from(
				document.querySelectorAll<HTMLElement>(
					".rc-auto-floating-card[data-roll-id]",
				),
			);
			for (const panel of panels)
				if (!observed.has(panel)) {
					resize.observe(panel);
					observed.add(panel);
				}
			for (const node of observed)
				if (!node.isConnected) {
					resize.unobserve(node);
					observed.delete(node);
				}
			const entries = selected
				.flatMap((id) => {
					const badge = badges.find((el) => el.dataset.rollId === id);
					if (
						!badge ||
						!badge.getClientRects().length ||
						badge.dataset.state === "open"
					)
						return [];
					const rect = badge.getBoundingClientRect();
					let left = 0,
						top = 0,
						right = window.innerWidth,
						bottom = window.innerHeight;
					for (
						let node = badge.parentElement;
						node;
						node = node.parentElement
					) {
						const style = getComputedStyle(node);
						if (
							/auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY)
						) {
							const bounds = node.getBoundingClientRect();
							left = Math.max(left, bounds.left);
							right = Math.min(right, bounds.right);
							top = Math.max(top, bounds.top);
							bottom = Math.min(bottom, bounds.bottom);
						}
					}
					if (
						rect.right <= left ||
						rect.left >= right ||
						rect.bottom <= top ||
						rect.top >= bottom
					)
						return [];
					const panel = panels.find((el) => el.dataset.rollId === id);
					return [
						{
							id,
							rect,
							height: Math.min(
								maxHeight,
								panel?.getBoundingClientRect().height || 190,
							),
						},
					];
				})
				.sort((a, b) => a.rect.top - b.rect.top || a.id.localeCompare(b.id));
			const positions: Record<string, Box> = {};
			const occupied: Box[] = [];
			let crowded = false;
			for (const entry of entries) {
				const { rect, height } = entry;
				const clampX = (x: number) =>
					Math.round(
						Math.max(MARGIN, Math.min(x, window.innerWidth - MARGIN - width)),
					);
				const clampY = (y: number) =>
					Math.round(
						Math.max(MARGIN, Math.min(y, window.innerHeight - MARGIN - height)),
					);
				const idealX = clampX(rect.left),
					idealY = rect.top - height - 6;
				const xs = new Set([
					idealX,
					clampX(rect.right + 6),
					clampX(rect.left - width - 6),
					MARGIN,
					clampX(window.innerWidth - MARGIN - width),
					...occupied.flatMap((box) => [
						clampX(box.left - width - GAP),
						clampX(box.left + box.width + GAP),
					]),
				]);
				const ys = new Set([
					clampY(idealY),
					clampY(rect.bottom + 6),
					MARGIN,
					clampY(window.innerHeight - MARGIN - height),
					...occupied.flatMap((box) => [
						clampY(box.top - height - GAP),
						clampY(box.top + box.height + GAP),
					]),
				]);
				const candidates: Box[] = [];
				for (const left of xs)
					for (const top of ys) {
						const box = { left, top, width, height };
						if (!occupied.some((other) => overlaps(box, other)))
							candidates.push(box);
					}
				const score = (box: Box) => {
					const coversBadge =
						box.left < rect.right &&
						box.left + box.width > rect.left &&
						box.top < rect.bottom &&
						box.top + box.height > rect.top;
					return (
						Math.abs(box.left - idealX) +
						Math.abs(box.top - idealY) +
						(coversBadge ? 1_000_000 : 0)
					);
				};
				const chosen = candidates.sort((a, b) => score(a) - score(b))[0];
				if (!chosen) {
					crowded = true;
					break;
				}
				positions[entry.id] = chosen;
				occupied.push(chosen);
			}
			let stack: Box | null = null;
			if (crowded && entries.length) {
				const height = Math.min(
					maxHeight,
					entries.reduce((sum, entry) => sum + entry.height, 0) +
						GAP * (entries.length - 1),
				);
				const anchor = entries[entries.length - 1]!.rect;
				stack = {
					left: Math.round(
						Math.max(
							MARGIN,
							Math.min(anchor.left, window.innerWidth - width - MARGIN),
						),
					),
					top: Math.round(
						Math.max(
							MARGIN,
							Math.min(
								anchor.top - height - 6,
								window.innerHeight - height - MARGIN,
							),
						),
					),
					width,
					height,
				};
			}
			const next = {
				positions: crowded ? {} : positions,
				stack,
				ids: entries.map((entry) => entry.id),
			};
			setLayout((previous) =>
				JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
			);
		}
		resize.observe(document.documentElement);
		const mutations = new MutationObserver(schedule);
		mutations.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-state", "data-roll-id"],
		});
		window.addEventListener("scroll", schedule, true);
		window.addEventListener("resize", schedule);
		schedule();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			mutations.disconnect();
			window.removeEventListener("scroll", schedule, true);
			window.removeEventListener("resize", schedule);
		};
	}, [key, enabled]);
	return layout;
}
