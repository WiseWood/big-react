import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';

const validEventTypeList = ['click'];

type EventCallback = (e: Event) => void;

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

// dom[xxx] = reactElement props
export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: string) {
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件');
		return;
	}

	if (__DEV__) {
		console.log('初始化事件', eventType);
	}

	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e);
	});
}

function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	// 覆写原来的阻止冒泡函数
	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;

		if (originStopPropagation) {
			originStopPropagation();
		}
	};

	return syntheticEvent;
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < paths.length; i++) {
		const callback = paths[i];
		callback.call(null, se);

		if (se.__stopPropagation) {
			break;
		}
	}
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
	const targetElement = e.target;

	if (targetElement === null) {
		console.warn('事件不存在target', e);
		return;
	}

	// 1. 从点击的目标DOM，向上遍历收集各节点事件
	const { bubble, capture } = collectPaths(
		targetElement as DOMElement,
		container,
		eventType
	);

	// 2. 构造合成事件（增强？）
	const syntheticEvent = createSyntheticEvent(e);

	// 模拟 DOM2 Events规范-DOM事件流
	// 3. 遍历 capture（捕获阶段）
	triggerEventFlow(capture, syntheticEvent);

	if (!syntheticEvent.__stopPropagation) {
		// 4. 遍历bubble（冒泡阶段）
		triggerEventFlow(bubble, syntheticEvent);
	}
}

function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		click: ['onClickCapture', 'onClick']
	}[eventType];
}

function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: string
) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};

	while (targetElement && targetElement !== container) {
		// 获取挂在真实 DOM 上的 props 数据
		const elementProps = targetElement[elementPropsKey];

		if (elementProps) {
			// click -> onClick onClickCapture
			const callbackNameList = getEventCallbackNameFromEventType(eventType);

			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					const eventCallback = elementProps[callbackName];

					if (eventCallback) {
						if (i === 0) {
							// capture
							paths.capture.unshift(eventCallback);
						} else {
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}

		// 向上遍历
		targetElement = targetElement.parentNode as DOMElement;
	}

	return paths;
}
