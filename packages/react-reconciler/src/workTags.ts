export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof HostComponent
	| typeof HostText;

export const FunctionComponent = 0;
export const HostRoot = 3; // 挂载的根节点 rootElement -> 对应的 fiberNode
export const HostComponent = 5; // div、span、p 等标签 -> 对应的 fiberNode
export const HostText = 6; // 文本节点 -> 对应的 fiberNode
