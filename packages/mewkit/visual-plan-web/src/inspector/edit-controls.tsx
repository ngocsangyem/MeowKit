/**
 * Bounded v1 edit controls for the selected frame — lane move + reorder, the
 * primary visual edits. Each control emits a typed patch op through the save
 * queue; the artifact refetches authoritatively after the save lands. (Annotation
 * and connector-label editing reuse the same op pipeline; their affordances are
 * follow-on UI — the ops + server routes already exist and are tested.)
 */

import type { Frame, Lane } from "../domain/artifact-types.js";

interface Props {
	frame: Frame;
	lanes: Lane[];
	onEdit: (op: unknown) => void;
}

export function EditControls({ frame, lanes, onEdit }: Props) {
	return (
		<div className="vp-edit-controls">
			<label className="vp-edit-field">
				Lane
				<select value={frame.laneId} onChange={(e) => onEdit({ type: "move-frame-lane", frameId: frame.id, laneId: e.target.value })}>
					{lanes.map((l) => (
						<option key={l.id} value={l.id}>{l.label ?? l.id}</option>
					))}
				</select>
			</label>
			<label className="vp-edit-field">
				Order
				<input
					type="number"
					defaultValue={frame.order}
					onBlur={(e) => {
						const order = Number(e.target.value);
						if (Number.isInteger(order) && order !== frame.order) onEdit({ type: "reorder-frame", frameId: frame.id, order });
					}}
				/>
			</label>
		</div>
	);
}
