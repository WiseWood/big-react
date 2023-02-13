// 执行递归

import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode } from './fiber';

let workInProgress: FiberNode | null = null;

function prepareFreshStack(fiber: FiberNode) {
	workInProgress = fiber;
}

function renderRoot(root: FiberNode) {
	// 初始化，让当前的 workInProgress 指向第一个要遍历的 fiberNode
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			console.warn('workLoop发生错误', e);
			workInProgress = null;
		}
	} while (true);
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber); // 可能返回子fiberNode 或者 null
	fiber.memoizedProps = fiber.pendingProps; // 此次工作单元结束后，确定props

	// 没有子节点，说明递阶段结束，进行归阶段
	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		// 否则，继续往下（递阶段）
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		completeWork(node);
		const sibling = node.sibling;

		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}

		node = node.return; // 往退回父节点
		workInProgress = node; // 继续处理父节点
	} while (node !== null);
}
