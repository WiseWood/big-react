import { appendChildToContainer, Container } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	// 递归
	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;

		// 判断子节点中是否含有 mutation 阶段要执行的 flags
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			// 继续向下遍历
			nextEffect = child;
		} else {
			/**
			 * 1、要么到底了
			 * 2、要么当前节点的子树中不包含 mutation 阶段要执行的 flags
			 */
			// 向上遍历
			up: while (nextEffect !== null) {
				// 开始处理当前节点的 flags
				commitMutationEffectsOnFiber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					nextEffect = sibling;
					// 回到外层，继续兄弟节点的递归
					break up;
				}

				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	// 处理 Placement 的flags
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		// 提交完移除
		finishedWork.flags &= ~Placement;
	}

	// flags: Update
	// flags: ChildDeletion
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行 Placement 操作', finishedWork);
	}

	// 插入的操作首先需要找到父节点（对于宿主环境为浏览器来说就是 DOM）
	const hostParent = getHostParent(finishedWork);

	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
	}
};

function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		// HostComponent HostRoot（找到宿主环境对应的 DOM）
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}

		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}

		parent = parent.return;
	}

	if (__DEV__) {
		console.warn('未找到host parent');
	}

	return null;
}

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	// 判断插入节点是否是 host 类型，若是，则执行宿主环境真正的插入方法
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}

	// 否则，递归，向下查找，例如：
	// function A() { return <div></div> }
	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
