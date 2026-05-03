/**
 * Toast — global notification slot.
 *
 * Single visible message at a time; new show() replaces current message.
 * Auto-dismisses after 4s. role="status" + aria-live="polite" for a11y.
 * z-60 (above gate drawers at z-50).
 *
 * Usage:
 *   1. Mount <ToastProvider> at the app root.
 *   2. Call useToast().show(msg) anywhere in the tree.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { COLORS } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";

// ── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
	show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
	return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [message, setMessage] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const show = useCallback((msg: string) => {
		// Cancel previous timer before setting new message
		if (timerRef.current !== null) clearTimeout(timerRef.current);
		setMessage(msg);
		timerRef.current = setTimeout(() => {
			setMessage(null);
			timerRef.current = null;
		}, DISMISS_MS);
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current !== null) clearTimeout(timerRef.current);
		};
	}, []);

	const ctxValue = useMemo<ToastContextValue>(() => ({ show }), [show]);

	return (
		<ToastContext.Provider value={ctxValue}>
			{children}
			<ToastSlot message={message} />
		</ToastContext.Provider>
	);
}

// ── Slot ─────────────────────────────────────────────────────────────────────

function ToastSlot({ message }: { message: string | null }) {
	if (!message) return null;

	return (
		<div
			role="status"
			aria-live="polite"
			className="fixed bottom-4 right-4 z-60 max-w-xs px-3 py-2 rounded text-[11px] font-mono"
			style={{
				background: COLORS.panelBg,
				border: `1px solid ${COLORS.glassBorder}`,
				color: COLORS.textPrimary,
				boxShadow: MK_TOKENS.effects.panelShadow,
				backdropFilter: "blur(4px)",
				pointerEvents: "none",
			}}
		>
			{message}
		</div>
	);
}
