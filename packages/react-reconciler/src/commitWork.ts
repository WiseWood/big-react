import {
	appendChildToContainer,
	commitUpdate,
	Container,
	insertChildToContainer,
	Instance,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';

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
				commitDeletion(childToDelete);
			});
		}
		// 提交完移除
		finishedWork.flags &= ~ChildDeletion;
	}
};

function commitDeletion(childToDelete: FiberNode) {
	let rootHostNode: FiberNode | null = null;

	// 删除子树时，要DFS子树所有节点，进行 unmount 处理
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				// TODO 解绑 ref
				return;
			case HostText:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				return;
			case FunctionComponent:
				// TODO useEffect unmount、解绑 ref
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	});

	// 说明子树是宿主环境原生DOM，执行宿主环境DOM操作，将其移除
	if (rootHostNode !== null) {
		// 实际上 rootHostNode 就是 childToDelete
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			removeChild((rootHostNode as FiberNode).stateNode, hostParent);
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
