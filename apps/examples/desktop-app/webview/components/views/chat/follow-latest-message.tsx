"use client";

import { useMessageScroller } from "@cline/ui/components/message-scroller";
import { useEffect, type RefObject } from "react";

/** Follow streamed text, nested tool rows and layout changes until the reader scrolls away. */
export function FollowLatestMessage({
	viewportRef,
	contentRef,
	latestUserId,
}: {
	viewportRef: RefObject<HTMLDivElement | null>;
	contentRef: RefObject<HTMLDivElement | null>;
	latestUserId?: string;
}) {
	const { scrollToEnd } = useMessageScroller();
	useEffect(() => {
		const viewport = viewportRef.current;
		const content = contentRef.current;
		if (!viewport || !content) return;
		let following = true;
		let frame = 0;
		let touchY = 0;
		const schedule = () => {
			if (frame || !following) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				if (following) scrollToEnd({ behavior: "auto" });
			});
		};
		const onWheel = (event: WheelEvent) => {
			if (event.deltaY < 0) following = false;
		};
		const onTouchStart = (event: TouchEvent) => {
			touchY = event.touches[0]?.clientY ?? 0;
		};
		const onTouchMove = (event: TouchEvent) => {
			const nextY = event.touches[0]?.clientY ?? touchY;
			if (nextY > touchY) following = false;
			touchY = nextY;
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				["ArrowUp", "PageUp", "Home"].includes(event.key) ||
				(event.key === " " && event.shiftKey)
			)
				following = false;
		};
		const onPointerDown = (event: PointerEvent) => {
			// Grabbing the scrollbar is also an explicit request to browse history.
			if (event.clientX >= viewport.getBoundingClientRect().right - 16)
				following = false;
		};
		const onScroll = () => {
			if (
				viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=
				8
			) {
				following = true;
				schedule();
			}
		};
		const mutations = new MutationObserver(schedule);
		mutations.observe(content, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		const resize =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(schedule);
		resize?.observe(content);
		resize?.observe(viewport);
		viewport.addEventListener("wheel", onWheel, { passive: true });
		viewport.addEventListener("touchstart", onTouchStart, { passive: true });
		viewport.addEventListener("touchmove", onTouchMove, { passive: true });
		viewport.addEventListener("keydown", onKeyDown);
		viewport.addEventListener("pointerdown", onPointerDown);
		viewport.addEventListener("scroll", onScroll, { passive: true });
		// A newly submitted prompt resumes following after the primitive has anchored its row.
		schedule();
		return () => {
			cancelAnimationFrame(frame);
			mutations.disconnect();
			resize?.disconnect();
			viewport.removeEventListener("wheel", onWheel);
			viewport.removeEventListener("touchstart", onTouchStart);
			viewport.removeEventListener("touchmove", onTouchMove);
			viewport.removeEventListener("keydown", onKeyDown);
			viewport.removeEventListener("pointerdown", onPointerDown);
			viewport.removeEventListener("scroll", onScroll);
		};
	}, [viewportRef, contentRef, latestUserId, scrollToEnd]);
	return null;
}
