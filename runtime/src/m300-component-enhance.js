// ---------------------------
// 组件增强器
// ---------------------------

// Component - 组件函数/类
// args - 初始化构造参数
// 返回增强后的组件对象
function enhance(Component, ...args) {
	let oComp = new Component(...args);

	// 添加字段
	enhanceFields(oComp);	// 组件对象ID等

	// 添加方法
	enhanceRender(oComp);	// 组件渲染
	enhanceState(oComp);	// 组件状态存取
	enhanceRef(oComp);		// 按引用名取DOM节点或组件对象
	enhanceRoot(oComp);		// 取组件根节点DOM元素

	return oComp;
}