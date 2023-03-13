import internals from 'shared/internals';
import { Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';

const { currentDispatcher } = internals;

export function renderWithHooks(wip: FiberNode) {
	const current = wip.alternate;

	if (current !== null) {
		// update
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	return children;
}

// mount 时的 hooks 集合
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

function mountState<State>(initialState: (() => State) | State): any {
	return;
}
