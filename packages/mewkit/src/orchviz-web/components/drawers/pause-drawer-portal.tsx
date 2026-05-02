/**
 * Slide-from-right portal shell for the PauseDetailDrawer.
 *
 * Mount/visible two-state pattern (mirrors PlanSwitcher) so the slide
 * transition runs on mount instead of snapping to its final position.
 * Document-level mousedown closes on outside click; document-level keydown
 * closes on ESC. Renders nothing while !mounted.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { COLORS } from "@/lib/colors";

const ANIMATION_MS = 220;
const DRAWER_WIDTH = 420;

interface PauseDrawerPortalProps {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
}

export function PauseDrawerPortal({ open, onClose, children }: PauseDrawerPortalProps) {
	const [mounted, setMounted] = useState(false);
	const [visible, setVisible] = useState(false);
	const closeTimer = useRef<number | null>(null);
	const panelRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		if (open) {
			if (closeTimer.current !== null) {
				window.clearTimeout(closeTimer.current);
				closeTimer.current = null;
			}
			setMounted(true);
			const id = requestAnimationFrame(() => setVisible(true));
			return () => cancelAnimationFrame(id);
		}
		setVisible(false);
		if (mounted) {
			closeTimer.current = window.setTimeout(() => {
				setMounted(false);
				closeTimer.current = null;
			}, ANIMATION_MS);
		}
		return undefined;
	}, [open, mounted]);

	useEffect(() => {
		return () => {
			if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
		};
	}, []);

	useEffect(() => {
		if (!open) return;
		const onKey = (ev: KeyboardEvent): void => {
			if (ev.key === "Escape") onClose();
		};
		const onMouseDown = (ev: MouseEvent): void => {
			const panel = panelRef.current;
			if (!panel) return;
			if (!panel.contains(ev.target as Node)) onClose();
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("mousedown", onMouseDown);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("mousedown", onMouseDown);
		};
	}, [open, onClose]);

	if (!mounted) return null;

	return createPortal(
		<div
			ref={panelRef}
			role="complementary"
			style={{
				position: "fixed",
				top: 0,
				right: 0,
				height: "100vh",
				width: DRAWER_WIDTH,
				zIndex: 50,
				background: COLORS.panelBg,
				borderLeft: `1px solid ${COLORS.holoBorder12}`,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
				transform: visible ? "translateX(0)" : `translateX(${DRAWER_WIDTH}px)`,
				transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1)`,
				willChange: "transform",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{children}
		</div>,
		document.body,
	);
}
