// ---------------------------
// 组件增强器
// ---------------------------

// 动态增加组件渲染功能
function enhanceRender(component) {

	!component.render && Object.defineProperty(component, "render", {
		get : ()=> function(state={}){
			let el, $$el, vnode;

			// 首次渲染，或再次渲染但找不到根节点时，按数据创建根节点返回
			if ( this.isInitRender ){
				extend(this.$state, state, this.$STATE_KEYS); // 深度克隆数据
				vnode = this.nodeTemplate(this.$state, this.$options, this.$actions, this); // 生成节点信息数据进行组件渲染
				el = createDom(vnode, this); // TODO 运行期检查结果是否正确？ // 默认上下文是当前组件，但slot需要由原组件管理，但又但是，通常不应该在组件标签上写slot属性
				if ( el && el.nodeType == 1 ) {
					$$(el).addClass(this.$COMPONENT_ID);
				} 
				this.isInitRender = false;
				return el;
			}

			// 再次渲染，先保存数据，再更新视图
			extend(this.$state, state, this.$STATE_KEYS);	// 深度克隆数据

			$$el = $$('.' + this.$COMPONENT_ID);
			if ( !$$el.length ){
				warn('dom node missing');					// 组件根节点丢失无法再次渲染
				return;
			}

			if (this.$updater){
				this.$updater(this.$state); 				// 更关注更新性能时，自定义逻辑实现视图更新
			}else{
				let vnode2 = this.nodeTemplate(this.$state, this.$options, this.$actions, this);
				diffRender(this, vnode2);					// 默认使用虚拟节点比较进行差异更新
			}

			return el;
		}
	});


}

