import { FiberRootNode } from './fiber';

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

// 获取优先级最高的 lane （二进制越小优先级越高）
export function getHighestPriorityLane(lanes: Lanes): Lane {
	/**
	 * 始终返回最靠右的那一位，也就是最小的
	 * 例如：
	 * ① 0b0011 -> 0b0001
	 * ② 0b0110 -> 0b0010
	 */
	return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
