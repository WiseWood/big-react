import {
	appendInitialChild,
	Container,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import { NoFlags } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

// 递归中的归阶段做的事
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
			} else {
				// 1、构建 DOM（当前 wip 节点）
				const instance = createInstance(wip.type, newProps);
				// 2、构建当前 DOM 的子树
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
			} else {
				// 1. 构建DOM
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip);
			}
			break;
	}
};

function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;

	// 递归当前 wip 节点
	while (node !== null) {
		// 最简单的情况：其子节点是 Host 类型的（ div、span、'hello world'），直接插入即可
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			// 否则，继续往下找子节点
			// 例如：组件A 实际上应该去拿到 <div></div>
			// function A () {
			//   return <div></div>;
			// }
			node.child.return = node;
			node = node.child;
			continue;
		}

		// 递归出口，当归的时候回到了当前 wip 节点
		if (node === wip) {
			return;
		}

		// 没有下级了，且也没有兄弟，一直往回归
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node?.return;
		}

		// 直到找到兄弟节点，继续递归
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

// 在归时，会一层一层往上传递
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
}
