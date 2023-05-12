import internals from 'shared/internals';
import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiber';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	UpdateQueue
} from './updateQueue';
import { scheduleUpdateOnFiber } from './workLoop';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

const { currentDispatcher } = internals;

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null; // 当前构建中的最新的 hook
let currentHook: Hook | null = null; // 上一次构建的 hook
let renderLane: Lane = NoLane;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export interface Effect {
	tag: Flags; // 标识 effect 对应的 hook类型
	create: EffectCallback | void;
	destroy: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null; // 用于构成 effect 相关 hook 对应的 effect 的环状链表
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 记录当前函数组件render对应的 fiber
	currentlyRenderingFiber = wip;
	// 重置 hooks链表
	wip.memoizedState = null;
	renderLane = lane;

	const current = wip.alternate;
	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;

	return children;
}

// mount 时的 hooks 集合
const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};

// update 时的 hooks 集合
const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 创建 hook，并建立 hook 链表链接
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;

	// 当前 FC FiberNode 标记本次更新存在副作用，需要触发 useEffect 回调
	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 创建此次构建的新 hook，并复用上一次构建的 hook 部分信息
	const hook = updateWorkInProgresHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect;
		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			// 依赖浅比较
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}

		// 不相同
		// 当前 FC FiberNode 标记本次更新存在副作用，需要触发 useEffect 回调
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		);
	}
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}

	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}

	return true;
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destroy: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};

	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		// 构成 effect 相关 hook 对应的 effect 的环状链表
		const lastEffect = updateQueue.lastEffect;

		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}

	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 创建 hook，并建立 hook 链表链接
	const hook = mountWorkInProgressHook();

	let memoizedState;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	const queue = createUpdateQueue<State>();
	// 记录 updateQueue，供之后 update 使用
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;

	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	// dispatch 记录在 queue 中，供之后 update 使用
	queue.dispatch = dispatch;

	return [memoizedState, dispatch];
}

function updateState<State>(): [State, Dispatch<State>] {
	// 创建 hook，并建立 hook 链表链接
	const hook = updateWorkInProgresHook();

	// 获取 mount 时 mountState 创建的队列
	const queue = hook.updateQueue as UpdateQueue<State>;
	// 获取 调用dispatch 时的创建的 update
	const pending = queue.shared.pending;
	// 置空，表示 update被消费了
	queue.shared.pending = null;

	if (pending !== null) {
		// 计算新 state 的逻辑
		const { memoizedState } = processUpdateQueue(
			hook.memoizedState,
			pending,
			renderLane
		);
		hook.memoizedState = memoizedState;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	// 不同
	const lane = requestUpdateLane();
	// 接入更新机制
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	};

	// mount时，第一个 hook
	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook; // 记录当前函数组件的 hooks
		}
	} else {
		// mount时，后面的 hook，构成单向链表
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}

	return workInProgressHook;
}

function updateWorkInProgresHook(): Hook {
	// TODO: render 阶段触发的更新

	let nextCurrentHook: Hook | null;

	// 上一次构建时，FC update 时的第一个 hook
	if (currentHook === null) {
		// 前一次构建的 fiberNode
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			// 获取前一次构建的 hook
			nextCurrentHook = current?.memoizedState;
		} else {
			// 处理边界情况，常理不会走到这里
			nextCurrentHook = null;
		}
	} else {
		// 上一次构建时，FC update 时，后面的 hook（当 hook 使用不当时，有可能为 null）
		nextCurrentHook = currentHook.next;
	}

	// 当 hook 使用不当时
	if (nextCurrentHook === null) {
		// 前一次构建：mount/update  useState1 useState2 useState3
		// 当前构建：update useState1 useState2 useState3 useState4
		// 例如：
		// function App() {
		// 	const [] = useState(1);
		// 	const [] = useState(2);
		// 	const [] = useState(3);
		//  // 不允许的
		// 	if (xxx) {
		// 		const [] = useState(4);
		// 	}
		// }
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的hook比上次执行时多`
		);
	}

	currentHook = nextCurrentHook as Hook;

	// 创建此次构建的新 hook，并复用上一次构建的 hook 部分信息
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	};

	// FC update时，第一个 hook
	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = newHook;
			currentlyRenderingFiber.memoizedState = workInProgressHook; // 记录当前函数组件的 hooks
		}
	} else {
		// FC update时，后面的 hook，构成单向链表
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook;
}
