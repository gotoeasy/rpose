// ---------------------------
// 组件
// ---------------------------

const mapTagComponent = {};					// 组件注册(tagName: Component Class)
const mapSingletonComp = {};				// 单例组件对象

function registerComponents(components={}){
	for ( let key in components) {
		mapTagComponent[key] = components[key];
	}
}

function getComponent(name){
	return mapTagComponent[name];
}

function newComponentProxy(componentKey, opt){
	let Component = mapTagComponent[componentKey];
	if ( !Component ) {
		throw new Error('component not found: ' + componentKey);	// 找不到指定标签的组件
	}

	let comp;
	if ( Component.Singleton ) {
		comp = mapSingletonComp[componentKey] || (mapSingletonComp[componentKey] = enhance(Component, opt)); // 单例
	}else{
		comp = enhance(Component, opt);
	}

    isFunction(comp.init) && comp.init();

	return comp; // 返回增强的组件对象
}

function createComponentByVnode(vnode){
	let opt = assign({}, vnode.a || {}, vnode.c && vnode.c.length ? {[$SLOT]: vnode.c}:{} ); // 传入属性和子虚拟节点
	return newComponentProxy(vnode.t, opt)
}

function domVnode(el, vnode){
	if ( !el ) return;
	let map = domVnode.m || (domVnode.m = new WeakMap());

	// 取值
	if ( !vnode ) {
		return map.get(el);			
	}

	// 设值
    let vn = vnode;
    if ( vnode.c ) {
        // 有子节点时，保存节点的副本，删除副本的子节点引用（直接删除子节点引用会破坏slot虚拟节点结构）
        vn = Object.assign({}, vnode);
	    delete vn.c;
    }

	let oVal = map.get(el);
	if ( !oVal ) {
		// 单纯虚拟节点
		return map.set(el, vn);
	}

	if ( !oVal.M ) {
		// 复合虚拟节点
		let mVal = {M:1};
		mVal[oVal.t] = oVal;	// 原单个虚拟节点
		map.set(el, mVal);
		oVal = mVal;
	}
	oVal[vn.t] = vn;		// 并入复合虚拟节点

	return oVal;
}

// 本方法调用的起点是组件的render方法
function createDom(vnode, $thisContext) {

    if ( !vnode ) {
        return; // 不显示的家伙
    }
	
	let el, $$el;
	if (vnode.t) {
		if (vnode.m) { // HTML标准标准定义的标签以外，都按组件看待。推荐自定义标签名用半角减号连接，如my-tag

			// 子组件渲染
			let comp = new createComponentByVnode(vnode); // 属性作为配置选项直接全部传入(子虚拟节点也按属性$SLOT传入)
			vnode.o = comp; // 虚拟节点挂上组件实例

			el = comp.render(); // 渲染为DOM，初始配置已通过选项传入

			// 组件有ref属性时，建立关联关系 【refs:{ c:{组件}， e:{节点} }】
			let refs, cls;
			if ( vnode.a && vnode.a.ref ) {
                // 默认上下文是当前组件，但slot的话需要由原组件对象管理，slot的原组件对象在虚拟节点属性中
                let $context = vnode.a.$context || $thisContext;
				refs = ($context.$refs = $context.$refs || {});
				let ref = refs.c = refs.c || {};
				cls = ref[vnode.a.ref] = ref[vnode.a.ref] || uid('_ref_'); // 类名

                // TODO 挂载前也能取。。。
			}

			if ( el ) {
				$$el = $$(el);
				$$el.addClass(comp.$COMPONENT_ID); // 使用组件对象ID插入到组件根节点class上建立关联

				// 组件有ref属性时，建立关联关系 【refs:{ c:{组件}， e:{节点} }】
				cls && $$el.addClass(vnode.r = cls);			// r=cls. 查找时，通过引用名查得cls，由cls查得DOM，由DOM查得单个或复合虚拟节点，再遍历比较虚拟节点的r可找到对应的组件虚拟节点，最后拿到组件对象

                // 组件创建初期，根据@show设定hidden样式
                if ( vnode.a && vnode.a['@show'] !== undefined ) {
                    vnode.a['@show'] ? $$el.removeClass('hidden') : $$el.addClass('hidden');
                }            
            }

		} else {
			// <script>标签特殊处理，创建<script>标签直接加到head中
			if ( /^script$/i.test(vnode.t) ) {
				return loadScript(vnode.a);
			}
			// <link>标签特殊处理，创建<link>标签直接加到head中
			if ( /^link$/i.test(vnode.t) ) {
				return loadLink(vnode.a);
			}

			// 创建节点【g属性代表SVG标签或SVG子标签，SVG标签及其子标签都用createElementNS创建，其他操作雷同】
			el = vnode.g ? document.createElementNS('http://www.w3.org/2000/svg', vnode.t) : document.createElement(vnode.t);
			$$el = $$(el);

			// 属性设定
			if (vnode.a) {
				for (let k in vnode.a) {
					if ( k == 'ref' ) {
						// 对ref属性做特殊处理：添加相应类名便于查找
                        let $context = vnode.a.$context || $thisContext;
						let refs = $context.$refs = $context.$refs || {};
						let ref = refs.e = refs.e || {};
						let cls = ref[vnode.a[k]] = ref[vnode.a[k]] || uid('_ref_'); // 类名
						$$el.addClass(vnode.r = cls);	// r=cls，查找时，通过引用名查得cls，由cls查得DOM

                        // TODO 挂载前也能取。。。
                    }
					$$el.attr(k, vnode.a[k]);
				}
			}
			
			// 事件绑定
			if (vnode.e) {
				for (let k in vnode.e) {
					if ( isFunction(vnode.e[k]) ) {
						$$(el).on(k, vnode.e[k] );
					}else if ( vnode.e[k] == undefined ) {
						// 没有定义事件处理方法，忽略
					}else{
						console.error('invalid event handle:', k, '=', vnode.e[k]); // 绑定的不是方法
					}
				}
			}

			// 创建子组件
			if (vnode.c) {
                for ( let i=0,vn,dom; vn=vnode.c[i++]; ) {
                    dom = createDom(vn, $thisContext);  // 可能undefined。。。。。。<script>或<link>
                    dom && el.appendChild(dom);
                }
			}

            // TODO 含slot属性模板标签的特殊考虑

		}
	} else {
		el = document.createTextNode(vnode.s);
	}

	// 每个真实DOM节点都关联一个对应的虚拟节点
	el && domVnode(el, vnode);

	return el;
}

function assignOptions(...objs) {
	if (objs.length == 1) {
		return objs[0];
	}

	let rs = objs[0];
	for (let i = 1; i < objs.length; i++) {
		for (let k in objs[i]) {
			if (k == "ref") {
				continue; // ref属性仅组件内部使用，不能被外部覆盖
			}
			if (k == "class") {
				if ( isString(objs[i][k]) ) {
					let ary = objs[i][k].split(/\s/);
					let objCls = {};
					ary.forEach(v => v.trim() && (objCls[v] = 1));
					rs[k] = objCls;
				} else {
					rs[k] = objs[i][k]; // Plain Object
				}
			} else {
				rs[k] = objs[i][k];
			}
		}
	}
	return rs;
}

function loadScript(attr){
	let ary = loadScript.s || (loadScript.s = []);
	// 仅支持含src属性的<script>标签，否则忽略。相同src只建一次
	if ( !attr || !attr.src || ary.includes(attr.src)) {
		return;
	}
	ary.push(attr.src);

	let el = document.createElement('script');
	el.src = attr.src;
	el.type = attr.type || 'text/javascript';

	document.head.appendChild(el);
}

function loadLink(attr){
	let ary = loadLink.s || (loadLink.s = []);
	// 仅支持含href属性的<link>标签，否则忽略。相同href只建一次
	if ( !attr || !attr.href || ary.includes(attr.href)) {
		return;
	}
	ary.push(attr.href);

	let el = document.createElement('link');
	el.href = attr.href;
	el.rel = attr.rel || 'stylesheet';

	document.head.appendChild(el);
}
