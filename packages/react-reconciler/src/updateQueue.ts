import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';

export interface Update<State> {
	action: Action<State>;
	next: Update<any> | null;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

// 创建更新
export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return {
		action,
		next: null
	};
};

// 创建更新队列
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

// 更新入列
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	// 更新批处理：构造环状链表
	if (pending === null) {
		// 第一次触发更新
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}

	updateQueue.shared.pending = update;
};

// 处理更新
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};

	if (pendingUpdate !== null) {
		/**
		 * 批处理 update（遍历环状链表）
		 * 注：并不是类似防抖/节流，只是交由最后一次更新来 批处理 前几次更新的 update
		 */

		// 第一个 update
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;

		// 批处理 update
		do {
			const action = pending.action;
			if (action instanceof Function) {
				// baseState:1   update ->  (x) => 4x  -> memoizedState:4
				// 例如：this.setState((x) => 4x)
				baseState = action(baseState);
			} else {
				// baseState:1   update ->  2  -> memoizedState:2
				// 例如：this.setState(2)
				baseState = action;
			}
			pending = pending?.next as Update<any>;
		} while (pending !== first);
	}

	result.memoizedState = baseState;
	return result;
};
