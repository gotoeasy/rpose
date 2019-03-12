
// 动态增加组件状态存取功能
function enhanceState(component) {

    /**
     * 取得组件对象的数据状态副本
     */
	Object.defineProperty(component, "getState", {
		get : ()=> function(){
			return extend({}, this.$state);
		}
	});

    /**
     * 设定组件对象的数据状态，并更新视图
     * 总是先保存数据状态后更新视图
     */
	Object.defineProperty(component, "setState", {
		get : ()=> function(state){
			state && this.render(state);
		}
	});

}