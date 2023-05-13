import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';

export class FiberNode {
	type: any; // fiberNode 对应的 reactElement 的类型
	tag: WorkTag; // fiberNode 的类型标记
	pendingProps: Props;
	key: Key;
	stateNode: any; // 对应的真实的 dom 节点
	ref: Ref | null;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null;
	flags: Flags;
	subtreeFlags: Flags;
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 实例属性赋值
		this.tag = tag;
		this.key = key || null;
		this.stateNode = null;
		this.type = null;
		this.ref = null;

		// 构成树状结构
		this.return = null; // 指向父fiberNode（为什么叫 return 而不是 father？ 因为 fiberNode 是一个工作单元，当工作结束后退出 -> 即到父节点）
		this.sibling = null;
		this.child = null;
		this.index = 0; // 表示同级的 fiberNode 的第几个

		// 作为工作单元
		this.pendingProps = pendingProps; // 刚开始工作时，props是什么
		this.memoizedProps = null; // 工作结束后，确定的props
		this.memoizedState = null;
		this.updateQueue = null;

		this.alternate = null; // 和对应的 fiberNode 之间切换，比如当前 fiberNode 是 current，则alternate 是 workInProgress
		this.flags = NoFlags; // 副作用
		this.subtreeFlags = NoFlags;
		this.deletions = null;
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

// 应用的根节点（非页面挂载的dom根节点）
export class FiberRootNode {
	container: Container; // 宿主环境，即页面挂载的dom根节点（真实dom）
	current: FiberNode; // 指向 hostRootFiber，即页面挂载的dom根节点对应的fiber
	finishedWork: FiberNode | null; // 更新完成以后的 hostRootFiber
	pendingLanes: Lanes; // 所有未被消费的 lane 集合
	finishedLane: Lane; // 本次更新消费的 lane
	pendingPassiveEffects: PendingPassiveEffects; // 用于存储此次更新自下而上收集的 useEffect create/destroy 回调

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;

		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		/**
		 * 第一种场景：首屏渲染 mount 时，fiberNodeRoot.current -> hostRootFiber 建立 alternate 与 current 关系
		 * 第二种场景：首次更新 update 时，节点 diff 尝试复用，建立 alternate 与 current 关系
		 */
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;

		wip.alternate = current;
		current.alternate = wip;
	} else {
		// 说明更新时（update）
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}

	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;

	// 判断 reactElement 的类型
	if (typeof type === 'string') {
		// <div/> type: 'div'
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}
