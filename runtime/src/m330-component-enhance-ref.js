
// 动态增加组件状态存取功能
function enhanceRef(component) {

    /**
     * 在组件范围内，按引用名查找DOM节点
	 * 
	 * @name 引用名
	 * @return DOM节点数组（找不到时数组长度为0）
     */
	Object.defineProperty(component, "getRefElements", {
		get : ()=> function(name){
			let cls = this.$refs && this.$refs.e ? this.$refs.e[name] : ''; // 引用名对应一个动态初始化的类名
			return cls ? [...new Set(document.querySelectorAll('.' + cls))] : [];
		}
	});

    /**
     * 在组件范围内，按引用名查找匹配的第一个DOM节点
	 * 
	 * @name 引用名
	 * @return DOM节点（找不到时null）
     */
	Object.defineProperty(component, "getRefElement", {
		get : ()=> function(name){
			let els = this.getRefElements(name);
            return els.length ? els[0] : null;
		}
	});

    /**
     * 在组件范围内，按引用名查找组件对象
	 * 
	 * @name 引用名
	 * @return 组件对象数组（找不到时数组长度为0）
     */
	Object.defineProperty(component, "getRefComponents", {
		get : ()=> function(name){
			let cls = this.$refs && this.$refs.c ? this.$refs.c[name] : ''; // 引用名对应一个组件对象ID，该ID已在相应节点的class中
			if ( !cls ) {
				return [];
			}

			let rs = [];
			let els = [...new Set(document.querySelectorAll('.' + cls))];

			els.forEach(el => {
				let vnode = domVnode(el);
				if ( vnode && vnode.M ) {
					// 复合虚拟节点（一个节点对应多个组件对象）
					for ( let k in vnode ) {
						if ( vnode[k].r == cls ) {
							rs.push(vnode[k].o);
							break;
						}
					}
				}else{
					// 独立虚拟节点（一个节点对应一个组件对象）
					rs.push(vnode.o);
				}
			});

			return rs;
		}
	});

    /**
     * 在组件范围内，按引用名查找匹配的第一个组件对象
	 * 
	 * @name 引用名
	 * @return 组件对象（找不到时null）
     */
	Object.defineProperty(component, "getRefComponent", {
		get : ()=> function(name){
			let objs = this.getRefComponents(name);
            return objs.length ? objs[0] : null;
		}
	});

}
