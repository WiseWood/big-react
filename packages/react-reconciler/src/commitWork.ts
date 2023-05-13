import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	PassiveEffect,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
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
				commitMutationEffectsOnFiber(nextEffect, root);
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

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const flags = finishedWork.flags;

	// 处理 Placement 的flags
	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);
		// 提交完移除
		finishedWork.flags &= ~Placement;
	}

	// flags: Update
	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		// 提交完移除
		finishedWork.flags &= ~Update;
	}

	// flags: ChildDeletion
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root);
			});
		}
		// 提交完移除
		finishedWork.flags &= ~ChildDeletion;
	}

	// flags：PassiveEffect
	if ((flags & PassiveEffect) !== NoFlags) {
		// 收集 create 回调
		commitPassiveEffect(finishedWork, root, 'update');
		// 移除 flag
		finishedWork.flags &= ~PassiveEffect;
	}
};

function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error('当FC存在PassiveEffect flag时，不应该不存在 effect');
		}
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
	}
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个 root host 节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1];

	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		// 记录所有同级的 host 节点
		let node = lastOne.sibling;
		while (node !== null) {
			// 判断当前遍历的子树节点是否为同级兄弟 host 节点
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
	/**
	 * 例如1：移除 ul，因为是 host，可以直接移除，然后要 ummount 子树所有的节点
	 * <div>
	 * 	<ul>
	 * 		<li></li>
	 * 		<li></li>
	 * 	</ul>
	 * </div>
	 * 例如2：移除 fragment，需要 ummount 子树所有的节点，判断当前遍历的子树节点 是否为 fragment 下的同级兄弟 host 节点，若是，则移除
	 * <>
	 * 	<span></span>
	 * 	<span></span>
	 * </>
	 */
	const rootHostChildrenToDelete: FiberNode[] = [];

	// 删除子树时，要DFS子树所有节点，进行 unmount 处理
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootHostChildrenToDelete, unmountFiber);
				// TODO 解绑 ref
				return;
			case HostText:
				recordHostChildrenToDelete(rootHostChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// TODO 、解绑 ref

				// useEffect unmount
				commitPassiveEffect(unmountFiber, root, 'unmount');

				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	});

	// 存在宿主环境的原生DOM类型（即，Host类型），执行宿主环境DOM操作，将其移除
	if (rootHostChildrenToDelete.length) {
		// 实际上 rootHostNode 就是 childToDelete
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootHostChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
		}
	}

	// 为了能被GC：垃圾回收
	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;

	while (true) {
		onCommitUnmount(node);

		if (node.child !== null) {
			// 向下遍历
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			// DFS 终止条件
			return;
		}

		while (node.sibling === null) {
			// DFS 终止条件
			if (node.return === null || node.return === root) {
				return;
			}

			// 向上归
			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行 Placement 操作', finishedWork);
	}

	// 插入的操作首先需要找到父节点（对于宿主环境为浏览器来说就是 DOM）
	const hostParent = getHostParent(finishedWork);

	// host sibling
	const sibling = getHostSibling(finishedWork);

	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findHostSibling: while (true) {
		// ② 向上找：“父亲节点” 对应的 “兄弟节点” 的 Host 节点
		while (node.sibling === null) {
			const parent = node.return;

			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}

			node = parent;
		}

		// ① 向下找：“兄弟节点” 的对应的 Host 节点
		node.sibling.return = node.return;
		node = node.sibling;
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 排除掉不稳定的兄弟节点：存在插入/移动操作
			if ((node.flags & Placement) !== NoFlags) {
				continue findHostSibling;
			}

			if (node.child === null) {
				continue findHostSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}

		// ③ 再次确保当前 “目标兄弟 Host 节点” 是稳定的
		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

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

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	// 判断插入节点是否是 host 类型，若是，则执行宿主环境真正的插入方法
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}
		return;
	}

	// 否则，递归，向下查找，例如：
	// function A() { return <div></div> }
	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
