// ---------------------------
// 组件增强器
// ---------------------------

// 动态增加组件字段属性
function enhanceFields(component) {

    // 【1】组件对象ID （也是组件根节点的一个class）
	Object.defineProperty(component, "$COMPONENT_ID", {
		value : uid('_cid_')
	});

    // 【2】是否初次渲染
	Object.defineProperty(component, "isInitRender", {
		value : true,
		writable : true
	});

}

