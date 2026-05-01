/**
 * PlanSwitcher — hamburger button + left-slide drawer for plan selection.
 *
 * - Hamburger <button> rendered inline in TopStrip-left
 * - Drawer rendered via createPortal into document.body at z-40
 * - ESC key + outside-click close
 * - DrawerBody (with useAvailablePlans) mounted only when open (R2-8/M8)
 * - Accessibility: aria-label, aria-expanded, role="dialog", aria-modal, ESC
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { COLORS } from "@/lib/colors";
import { DrawerBody } from "./drawer-body";

interface PlanSwitcherProps {
	selectedSlug: string | null;
	onSelect: (slug: string | null) => void;
}

export function PlanSwitcher({ selectedSlug, onSelect }: PlanSwitcherProps) {
	const [isOpen, setIsOpen] = useState(false);

	const open = (): void => setIsOpen(true);
	const close = (): void => setIsOpen(false);

	// ESC key closes drawer
	useEffect(() => {
		if (!isOpen) return;
		const handler = (ev: KeyboardEvent): void => {
			if (ev.key === "Escape") close();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [isOpen]);

	const drawer = isOpen
		? createPortal(
				<div
					className="fixed inset-0 z-40 flex"
					style={{ background: "rgba(5,5,16,0.55)" }}
					onClick={(e) => {
						if (e.target === e.currentTarget) close();
					}}
				>
					{/* Left-slide drawer panel */}
					<div
						className="h-full w-[320px] flex flex-col"
						role="dialog"
						aria-modal="true"
						aria-label="Switch plan"
						style={{
							background: COLORS.panelBg,
							borderRight: `1px solid ${COLORS.glassBorder}`,
							fontFamily: "'SF Mono', 'Fira Code', monospace",
						}}
					>
						{/* Drawer header */}
						<div
							className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b"
							style={{ borderColor: COLORS.panelSeparator }}
						>
							<span
								className="text-[10px] uppercase tracking-widest"
								style={{ color: COLORS.holoBase }}
							>
								Plans
							</span>
							<button
								type="button"
								onClick={close}
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

						{/* Drawer body — useAvailablePlans mounted here (R2-8) */}
						<DrawerBody
							selectedSlug={selectedSlug}
							onSelect={onSelect}
							onClose={close}
						/>
					</div>
				</div>,
				document.body,
			)
		: null;

	return (
		<>
			{/* Hamburger trigger button */}
			<button
				type="button"
				onClick={open}
				aria-label="Switch plan"
				aria-expanded={isOpen}
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
				{/* 3-line hamburger SVG */}
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

			{drawer}
		</>
	);
}
