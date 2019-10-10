
// 取组件根节点DOM元素
function enhanceRoot(component) {

    /**
     * 取组件根节点DOM元素，取不到时返回null
     */
	Object.defineProperty(component, "getRootElement", {
		get : ()=> function(){
			let $$el = $$('.' + this.$COMPONENT_ID);
			return $$el.length ? $$el[0] : null;
		}
	});

}
