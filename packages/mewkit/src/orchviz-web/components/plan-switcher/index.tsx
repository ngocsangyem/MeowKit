/**
 * PlanSwitcher — hamburger button + left-slide drawer for plan selection.
 *
 * - Hamburger <button> rendered inline in TopStrip-left
 * - Drawer rendered via createPortal into document.body at z-40
 * - ESC key + outside-click close
 * - DrawerBody mounted only while open (so useAvailablePlans only polls
 *   when the drawer is visible)
 * - Slide-in animation: 220ms cubic-bezier(0.2, 0, 0, 1) on transform
 *   + 180ms backdrop fade. Uses a mounted/visible two-state pattern so
 *   the panel actually transitions on mount and unmounts after the
 *   close animation completes.
 * - Accessibility: complementary landmark role (browse, not modal),
 *   aria-labelledby, hamburger has aria-controls pointing at the panel id.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COLORS } from "@/lib/colors";
import type { UseActivePlanResult } from "@/hooks/use-active-plan";
import { DrawerBody } from "./drawer-body";

const PANEL_ID = "plan-drawer";
const HEADER_ID = "plan-drawer-heading";
const ANIMATION_MS = 220;

interface PlanSwitcherProps {
	selectedSlug: string | null;
	onSelect: (slug: string | null) => void;
	/** Lifted active plan — reused by the tree row matching selectedSlug. */
	activePlan: UseActivePlanResult;
	/** Setter for the LiveViewChip subtitle, fired on phase/todo click. */
	onLiveViewSubtitle: (subtitle: string | null) => void;
}

export function PlanSwitcher({
	selectedSlug,
	onSelect,
	activePlan,
	onLiveViewSubtitle,
}: PlanSwitcherProps) {
	const [isOpen, setIsOpen] = useState(false);

	const open = (): void => setIsOpen(true);
	const close = (): void => setIsOpen(false);

	useEffect(() => {
		if (!isOpen) return;
		const handler = (ev: KeyboardEvent): void => {
			if (ev.key === "Escape") close();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen]);

	return (
		<>
			<button
				type="button"
				onClick={open}
				aria-label="Switch plan"
				aria-expanded={isOpen}
				aria-controls={PANEL_ID}
				className="flex flex-col justify-center items-center gap-[3px] p-1.5 rounded"
				style={{
					background: isOpen ? COLORS.toggleActive : "transparent",
					border: `1px solid ${isOpen ? COLORS.toggleBorder : "transparent"}`,
					cursor: "pointer",
					width: 28,
					height: 28,
					flexShrink: 0,
					transition: "background 0.12s ease",
				}}
			>
				<svg
					width="14"
					height="11"
					viewBox="0 0 14 11"
					fill="none"
					aria-hidden="true"
				>
					<rect x="0" y="0" width="14" height="1.5" rx="0.75" fill={COLORS.holoBase} />
					<rect x="0" y="4.75" width="14" height="1.5" rx="0.75" fill={COLORS.holoBase} />
					<rect x="0" y="9.5" width="14" height="1.5" rx="0.75" fill={COLORS.holoBase} />
				</svg>
			</button>

			<DrawerPortal
				isOpen={isOpen}
				onClose={close}
				selectedSlug={selectedSlug}
				onSelect={onSelect}
				activePlan={activePlan}
				onLiveViewSubtitle={onLiveViewSubtitle}
			/>
		</>
	);
}

interface DrawerPortalProps {
	isOpen: boolean;
	onClose: () => void;
	selectedSlug: string | null;
	onSelect: (slug: string | null) => void;
	activePlan: UseActivePlanResult;
	onLiveViewSubtitle: (subtitle: string | null) => void;
}

/**
 * Two-state mount/visible pattern: keep the portal mounted while either
 * `isOpen` is true OR the close animation is still in flight. `visible`
 * drives the transform + opacity; flipping it on the next frame ensures
 * the transition runs (rather than the panel snapping into its final
 * position because the styles applied on the same frame as the mount).
 */
function DrawerPortal({
	isOpen,
	onClose,
	selectedSlug,
	onSelect,
	activePlan,
	onLiveViewSubtitle,
}: DrawerPortalProps) {
	const [mounted, setMounted] = useState(false);
	const [visible, setVisible] = useState(false);
	const closeTimer = useRef<number | null>(null);

	useLayoutEffect(() => {
		if (isOpen) {
			if (closeTimer.current !== null) {
				window.clearTimeout(closeTimer.current);
				closeTimer.current = null;
			}
			setMounted(true);
			// Defer the visibility flip to the next frame so the browser
			// records the initial (translateX(-100%)) styles before the
			// transition runs to translateX(0).
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
	}, [isOpen, mounted]);

	useEffect(() => {
		return () => {
			if (closeTimer.current !== null) {
				window.clearTimeout(closeTimer.current);
			}
		};
	}, []);

	if (!mounted) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-40 flex"
			style={{
				background: visible ? COLORS.scrimVisible : COLORS.scrimHidden,
				transition: "background 180ms ease",
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				id={PANEL_ID}
				role="complementary"
				aria-labelledby={HEADER_ID}
				className="h-full w-[320px] flex flex-col"
				style={{
					background: COLORS.panelBg,
					borderRight: `1px solid ${COLORS.glassBorder}`,
					fontFamily: "'SF Mono', 'Fira Code', monospace",
					transform: visible ? "translateX(0)" : "translateX(-100%)",
					transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.2, 0, 0, 1)`,
					willChange: "transform",
				}}
			>
				<div
					className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b"
					style={{ borderColor: COLORS.panelSeparator }}
				>
					<span
						id={HEADER_ID}
						className="text-[10px] uppercase tracking-widest"
						style={{ color: COLORS.holoBase }}
					>
						Plans
					</span>
					<button
						type="button"
						onClick={onClose}
						className="px-2 text-[14px]"
						style={{
							background: "transparent",
							border: "none",
							color: COLORS.scrollBtnText,
							cursor: "pointer",
						}}
						aria-label="Close plan switcher"
					>
						×
					</button>
				</div>

				<DrawerBody
					selectedSlug={selectedSlug}
					onSelect={onSelect}
					onClose={onClose}
					activePlan={activePlan}
					onLiveViewSubtitle={onLiveViewSubtitle}
				/>
			</div>
		</div>,
		document.body,
	);
}
