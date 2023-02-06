import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
	Type,
	Key,
	Ref,
	Props,
	ReactElementType,
	ElementType
} from 'shared/ReactTypes';

const ReactElement = (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType => {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE, // 指明当前数据结构是 ReactElement
		type,
		key,
		ref,
		props,
		__mark: 'fromKaSong' // 仅用于标记这是自己编写的element，源码没有这个
	};
	return element;
};

export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
	let key: Key = null;
	let ref: Ref = null;
	const props: Props = {};

	for (const prop in config) {
		const val = config[props];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val; // 转换为字符串
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		// 是 config 自己的属性，而非原型的
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	const maybeChildrenLength = maybeChildren.length;
	if (maybeChildrenLength) {
		if (maybeChildren === 1) {
			props.children = maybeChildren[0];
		} else {
			props.children = maybeChildren;
		}
	}

	return ReactElement(type, key, ref, props);
};

export const jsxDEV = (type: ElementType, config: any) => {
	let key: Key = null;
	let ref: Ref = null;
	const props: Props = {};

	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val; // 转换为字符串
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		// 是 config 自己的属性，而非原型的
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};

/**
 * 由于以下情况传参都有区别：
 * 1、createElement与jsx
 * createElement与jsx之所以会有这些区别更详细的原因可以参考createlement-rfc
 * （https://github.com/reactjs/rfcs/blob/createlement-rfc/text/0000-create-element-changes.md#dev-only-transforms）
 * 2、jsx在生产环境与开发环境
 * 所以我们起码需要实现createElement与jsx这2个API，如果为了更高的源码还原度，我们甚至应该实现3个版本（createElement与生产、开发环境下的jsx），以应对使用不同API的场景（比如对于部分测试用例，使用的是createElement）
 * 本节课程没有区分jsx与createElement，这是不严谨的。
 */
