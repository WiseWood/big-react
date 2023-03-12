import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { ReactElementType } from 'shared/ReactTypes';
import { mountChildFibers, reconcilerChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';

// 递归中的递阶段
export const beginWork = (wip: FiberNode) => {
	// 比较，返回子fiberNode

	// 判断 fiberNode 的类型
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip);
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型');
			}
			break;
	}

	return null;
};

function updateFunctionComponent(wip: FiberNode) {
	const nextChildren = renderWithHooks(wip);
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

// 更新rootElement 对应的fiberNode：hostRootFiber
function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;

	// 取出当前更新的单元
	const pendingUpdate = updateQueue.shared.pending;
	// 置空
	updateQueue.shared.pending = null;

	// 开始处理更新，对于 HostRoot 更新来说，此时状态为 reactElement，即 <App/>
	const { memoizedState } = processUpdateQueue(baseState, pendingUpdate);

	// 设置新的状态
	wip.memoizedState = memoizedState;

	// 获取到子 reactElement，即 <App/>
	const nextChildren = wip.memoizedState;
	// 比较子 current 与 子 reactElement
	reconcileChildren(wip, nextChildren);

	// 返回子 fiberNode
	return wip.child;
}

// 更新 div、span 等标签对应的 fiberNode：HostComponet
function updateHostComponent(wip: FiberNode) {
	// 标签等 无状态，无需更新状态
	// 返回子 fiberNode即可
	const nextProps = wip.pendingProps;
	// 获取到子 reactElement
	const nextChildren = nextProps.children;
	// 比较子 current 与 子 reactElement
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;

	// HootRootFiber 会走 update，因为在 createContainer 时已经生成了 FiberNodeRoot，带有 current 为 hostRootFiber
	if (current !== null) {
		// update
		wip.child = reconcilerChildFibers(wip, current?.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
}
