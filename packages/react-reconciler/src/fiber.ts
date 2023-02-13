import { Props, Key, Ref } from 'shared/ReactTypes';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

export class FiberNode {
	type: any; // 节点的对应的真实 dom 的类型？？
	tag: WorkTag; // 节点的标记类型
	pendingProps: Props;
	key: Key;
	stateNode: any; // 对应的真实的 dom 节点
	ref: Ref | null;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	memoizedProps: Props | null;
	alternate: FiberNode | null;
	flags: Flags;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 实例属性赋值
		this.tag = tag;
		this.key = key;
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

		this.alternate = null; // 和对应的 fiberNode 之间切换，比如当前 fiberNode 是 current，则alternate 是 workInProgress
		this.flags = NoFlags; // 副作用
	}
}
