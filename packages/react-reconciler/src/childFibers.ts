import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { Props, ReactElementType } from 'shared/ReactTypes';
import {
	createFiberFromElement,
	createWorkInProgress,
	FiberNode
} from './fiber';
import { ChildDeletion, Placement } from './fiberFlags';
import { HostText } from './workTags';

type ExistingChildren = Map<string | number, FiberNode>;

// 通过闭包，进行函数
function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return;
		}

		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return;
		}

		let childToDelete = currentFirstChild;

		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: ReactElementType
	) {
		const key = newChild.key;
		while (currentFiber !== null) {
			// update 流程
			if (currentFiber.key === key) {
				// key 相同
				if (newChild.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === newChild.type) {
						// key 和 type 都相同（例如：A1 -> A1 或 A1BC -> A1）
						// 当前节点可复用
						const existing = useFiber(currentFiber, newChild.props);
						existing.return = returnFiber;

						// 标记删除其他所有兄弟 fiberNode
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}

					// key 相同，type 不同（例如： A1 -> B1 或  ABC -> B1）
					// 删除所有旧的
					deleteRemainingChildren(returnFiber, currentFiber);
					break;
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', newChild);
						break;
					}
				}
			} else {
				// key 不同
				// 删除旧的，继续单节点 diff 其他兄弟 fiberNode
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}

		// 根据 reactElement 创建 fiberNode
		const fiber = createFiberFromElement(newChild);
		fiber.return = returnFiber;

		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update 流程
			if (currentFiber.tag === HostText) {
				// 类型没变，当前节点可以复用
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				// 标记删除其他所有兄弟 fiberNode
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			// 删除旧的
			deleteChild(returnFiber, currentFiber);
			// 继续单节点 diff 其他兄弟 fiberNode
			currentFiber = currentFiber.sibling;
		}

		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (
			// 标记优化：当 mount 首屏渲染时，不需要标记(shouldTrackEffects: false) 子 fiberNode，因为此时直接 Placement HostRoot 就行
			shouldTrackEffects &&
			// 说明是新节点
			fiber.alternate === null
		) {
			fiber.flags |= Placement;
		}
		return fiber;
	}

	function reconcilerChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 同层级的最后一个 wip fiberNode
		let lastNewFiber: FiberNode | null = null;
		// 同层级的第一个 wip fiberNode
		let firstNewFiber: FiberNode | null = null;
		// 节点移动参照物：同层级、已遍历的、可复用的、最后一个 wip fiberNode 在 current 中 对应的 index
		let lastPlacedIndex = 0;

		// 1. 将 current 所有子 fiberNode 保存在 map 中
		const existingChildren: ExistingChildren = new Map();
		let current = currentFirstChild;
		while (current !== null) {
			// 没有 key 取 index
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		// 遍历 newChild
		for (let i = 0; i < newChild.length; i++) {
			// 2. 寻找 current 中 是否存在 当前 element 对应的、可复用的 fiberNode
			const after = newChild[i];
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

			// 处理不了的节点，继续下一个
			if (newFiber === null) {
				continue;
			}

			// 3. 更新 wip fiberNode 信息
			newFiber.index = i;
			newFiber.return = returnFiber;

			// 4. 构造 wip fiberNode 的同级关系
			if (lastNewFiber === null) {
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = newFiber;
			}

			if (!shouldTrackEffects) {
				continue;
			}

			// 5. 标记：移动 or 插入
			const current = newFiber.alternate;
			if (current !== null) {
				// update
				const oldIndex = current.index;
				// 当前节点旧索引 相比于 前一个索引小了（当前节点实际上在前一个之后），说明在更新时向右移动了
				if (oldIndex < lastPlacedIndex) {
					// 标记移动（更新后需要向右移动）
					newFiber.flags |= Placement;
					continue;
				} else {
					// 不移动，记录当前节点的旧 index，用于下一个节点比对其是否移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount or update 时的新节点
				// 插入
				newFiber.flags |= Placement;
			}
		}

		// 6. 将 currnet map 中剩下的（说明都不可复用）标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index;
		const before = existingChildren.get(keyToUse);

		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				// 存在 key 相同的 fiberNode
				if (before.tag === HostText) {
					// 且 tag 相同，说明 before fiberNode 为可复用节点，从 map 中移除
					existingChildren.delete(keyToUse);
					// 复用节点
					return useFiber(before, { content: element + '' });
				}
			}
			// 不可复用，创建新的
			return new FiberNode(HostText, { content: element + '' }, null);
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (before) {
						// 存在 key 相同的
						if (before.type === element.type) {
							// 且 type 也相同，说明 before fiberNode 为可复用节点，从map中移除
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}
					// 不可复用，创建新的
					return createFiberFromElement(element);
			}

			// TODO: 数组类型
			if (Array.isArray(element) && __DEV__) {
				console.warn('还未实现数组类型的child');
			}
		}

		return null;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// 判断当前fiber的类型
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
				default:
					if (__DEV__) {
						console.warn('未实现的reconciler类型', newChild);
					}
					break;
			}

			// 多节点的情况 ul > li*3
			if (Array.isArray(newChild)) {
				return reconcilerChildrenArray(returnFiber, currentFiber, newChild);
			}
		}

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}

		// 兜底删除（什么场景？什么意义？）
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild);
		}

		return null;
	};
}

function useFiber(currentFiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(currentFiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

export const reconcilerChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
