/**
 * Wobble filter defs — a hidden SVG carrying the `#vp-wobble` turbulence
 * displacement filter (agent-native's sketch wobble: fractalNoise + a sub-pixel
 * displacement so the whole frame reads as one hand drawing). Referenced from
 * CSS (`filter: url(#vp-wobble)`) on artboard bodies and connectors in sketchy
 * mode only; the reduced-motion media query in the stylesheet keeps it off for
 * users who opt out of motion effects.
 */

export function WobbleFilterDefs() {
	return (
		<svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }} focusable="false">
			<defs>
				<filter id="vp-wobble" x="-3%" y="-3%" width="106%" height="106%">
					<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="7" result="noise" />
					<feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
				</filter>
			</defs>
		</svg>
	);
}
