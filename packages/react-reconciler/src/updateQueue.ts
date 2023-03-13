import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';

export interface Update<State> {
	action: Action<State>;
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
		action
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
		const action = pendingUpdate.action;
		if (action instanceof Function) {
			// baseState:1   update ->  (x) => 4x  -> memoizedState:4
			// 例如：this.setState((x) => 4x)
			result.memoizedState = action(baseState);
		} else {
			// baseState:1   update ->  2  -> memoizedState:2
			// 例如：this.setState(2)
			result.memoizedState = action;
		}
	}

	return result;
};
