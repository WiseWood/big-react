export type Lane = number;
export type Lanes = number; // lane 的集合，占用空间更小

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

// 根据触发情况的不同，返回不同的优先级（即，不同更新有不同的优先级）
export function requestUpdateLane() {
	return SyncLane;
}
