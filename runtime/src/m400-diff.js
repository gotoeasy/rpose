// ---------------------------
// 虚拟节点比较和差异更新
// ---------------------------

/**
 * 组件对象的虚拟节点比较及差异更新
 *
 * @param component 组件对象
 * @param vnode 新虚拟节点
 * @return 根节点，无根节点时undefined
 */
function diffRender(component, vnode2){

	// 组件根节点
	let $$el = $$('.' + component.$COMPONENT_ID);
	if ( !$$el.length ) {
		error('root node not found:', component.$COMPONENT_ID); // 根节点找不到，通常不应该，多数是DOM节点被其他途径修改了
		return;
	}

	// 新虚拟节点不存在，意欲销毁组件对象
	if ( !vnode2 ) {
		$$el.remove(); // 删除
		return;
	}

	// 找出原虚拟节点
	let vnode1 = domVnode($$el[0]);
	vnode1.M && (vnode1 = vnode1[vnode2.t]); // 复合节点时继续深究

	if ( vnode2.m ) {
//		vnode1.o.setState(vnode2.c ? {[$SLOT]: vnode2.c} : undefined);	// 子组件对象时，交由子组件对象自己去做差异更新(如果有虚拟子节点则传入)
		vnode1.o.setState( {[$SLOT]: vnode2.c} );	// 子组件对象时，交由子组件对象自己去做差异更新(传入虚拟子节点)

        if ( vnode2.a && vnode2.a['@show'] !== undefined ) {
            vnode2.a['@show'] ? $$el.removeClass('hidden') : $$el.addClass('hidden');
        }

		return;
	}

	// 原虚拟节点找不到，或不是同一节点，替换
	let attr1 = (vnode1 || {}).a || {};
	let attr2 = vnode2.a || {};
	if ( !vnode1 || vnode1.k != vnode2.k || ( (vnode1.t || vnode1.t) && vnode1.t != vnode2.t)
		|| ( (attr1.id || attr2.id) && attr1.id != attr2.id )
		|| ( (attr1.ref || attr2.ref) && attr1.ref != attr2.ref )
		) {
		let el = createDom(vnode2, component);
		$$el.replaceWith( el ); // 替换
		return el;
	}

	// 属性差异比较更新
	let diffAttrs = getDiffAttrs(vnode1, vnode2);
	if ( diffAttrs ) {
		for ( let k in diffAttrs ) {
			vnode1.a[k] = diffAttrs[k];
			$$el.attr(k, diffAttrs[k]); // 属性更新
		}
	}
	
	// 子节点差异比较
	diffRenderChildern(component, $$el[0], vnode2);
	return $$el[0];
}

// TODO 优化算法
function diffRenderChildern(component, parent, parentVnode2){

	let childern1 = [...(parent.childNodes || [])];
	let childern2 = parentVnode2.c || [];

	// 原节点不存在，直接插入全部新子节点
	if ( !childern1.length ) {
		return childern2.forEach(vn => parent.appendChild( createDom(vn, component) ));
	}

	// 包装成新数组便于打标记比较 (vn：虚拟节点)
	let ary1 = [], ary2 = [];
	childern1.forEach(v => ary1.push({vn: domVnode(v), el:v}));
	childern2.forEach(v => ary2.push({vn: v}));

	let matchAll = 1;
	if ( ary1.length == ary2.length ) {
		// 大多情况下，都是节点没变仅修改属性，针对这种情况优化，直接按下标比较
		for ( let i=0,wv1,wv2; i<ary1.length; i++) {
			wv1 = ary1[i];
			wv2 = ary2[i];
			if ( matchWvnode(wv1, wv2) ) {
				wv1.S = 1;
				wv2.S = 1;
				wv2.wv1 = wv1;
			}else{
				matchAll = 0;
				break;
			}
		}
	}else{
		matchAll = 0;
	}

	if ( !matchAll ) {
		// 非顺序完全一致，按普通算法比较		
		ary2.forEach(wv => !wv.S && findVnode(ary1, wv));			// 查找并标记 (找到时都标记S:1)
		ary1.filter(wv => wv.S ? 1 : ($$(wv.el).remove() && 0) );	// 原节点没被找出来的全部删除，并从包装数组中删除

		// 原节点被删光时，直接插入全部新子节点
		if ( !ary1.length ) {
			return ary2.forEach(wv => parent.appendChild( createDom(wv.vn, component) ));
		}
	}


	// 按新虚拟节点顺序更新视图
	let j = 0;
	let wv1 = ary1[j];
	for ( let i=0,idx,wv2; i<ary2.length; i++ ) {
		wv2 = ary2[i];

		if ( !wv2.S ) {
//console.info('----------diff----insert-------', wv2.vn, wv1)
			let el = createDom(wv2.vn, component);
			if ( el ) { // 不是所有组件都会渲染返回节点
				if ( wv1 ) {
					parent.insertBefore( el, wv1.el );	// 在vnode1节点前插入新子节点
				}else{
					parent.appendChild( el )				// 追加新子节点到尾部
				}
			}
		}else{
			if ( wv2.wv1 != wv1 ) {
//console.info('----------diff----move-------', wv1)
				// 数组模拟移动，以保持和DOM操作顺序一致
				ary1.splice(j, 0, ary1.splice(ary1.indexOf(wv2.wv1), 1)[0] );	// 修改数组：移动idx元素到j前面
				j++;

// TODO FixMe
				// 真实DOM移动
				parent.insertBefore(wv2.wv1.el, wv1.el);						// 原节点不需要先删除 // parent.removeChild(wv2.wv1.el);

				if ( wv2.vn.m ) {
					// 是组件标签则调用组件对象做差异更新
					wv2.wv1.vn[wv2.vn.t].o.setState( {[$SLOT]: wv2.vn.c} );		// 传入子虚拟节点参数
                    
                    if ( wv2.vn.a && wv2.vn.a['@show'] !== undefined ) {
                        wv2.vn.a['@show'] ? $$(wv2.el).removeClass('hidden') : $$(wv2.el).addClass('hidden');
                    }

				}else{
					let diffAttrs = getDiffAttrs(wv2.wv1.vn, wv2.vn);			// 比较属性差异
					if ( diffAttrs ) {
						// 节点属性更新
						for ( let k in diffAttrs ) {
							wv2.wv1.vn.a[k] = diffAttrs[k];
							$$(wv2.wv1.el).attr(k, diffAttrs[k]);
						}
					}else if (!wv2.vn.t && wv2.wv1.vn.s != wv2.vn.s ){
						// 文本节点字符串更新
						wv2.wv1.vn.s = wv2.vn.s;
						wv2.wv1.el.textContent = wv2.vn.s;
					}
				}
				
			}else{
				// 一样顺序的相同节点，比较属性后继续下一个
				if ( wv2.vn.m ) {
					wv1.vn[wv2.vn.t].o.setState( {[$SLOT]: wv2.vn.c} );	// 传入子虚拟节点参数

                    if ( wv2.vn.a && wv2.vn.a['@show'] !== undefined ) {
                        wv2.vn.a['@show'] ? $$(wv1.el).removeClass('hidden') : $$(wv1.el).addClass('hidden');
                    }

                }else{
					let diffAttrs = getDiffAttrs(wv1.vn, wv2.vn);				// 比较属性差异
					if ( diffAttrs ) {
//console.info('----------diff----update-------', diffAttrs)
						// 节点属性更新
						for ( let k in diffAttrs ) {
							wv1.vn.a[k] = diffAttrs[k];
							$$(wv1.el).attr(k, diffAttrs[k]);
						}
					}else if (!wv2.vn.t && wv1.vn.s != wv2.vn.s ){
//console.info('----------diff----update-------', wv1.vn)
						// 文本节点字符串更新
						wv1.vn.s = wv2.vn.s;
						wv1.el.textContent = wv2.vn.s;
					}
				}
				wv1 = ary1[++j];
			}
		}
	}

	// 非新建节点的子节点继续处理
	ary2.forEach(wv => {
		if ( wv.S ) {
			if ( wv.vn.m ) {
				wv.wv1.vn[wv.vn.t].o.setState( {[$SLOT]: wv.vn.c} );		// 传入子虚拟节点参数
			}else{
				diffRenderChildern(component, wv.wv1.el, wv.vn);
			}
		}
	});

}


function findVnode(wvnodes, wv2){
	let vnode1, vnode2 = wv2.vn;
	for ( let i=0,wv1; wv1=wvnodes[i++]; ) {
		if ( matchWvnode(wv1, wv2) ) {
			wv1.S = 1;
			wv2.S = 1;
			return wv2.wv1 = wv1;
		}
	}
}

function matchWvnode(wv1, wv2){
	if ( wv1.S ) {
		return 0; // 已标记过的不再匹配
	}

	let vnode1 = wv1.vn, vnode2 = wv2.vn;
	if ( vnode1.M ) {
		vnode1 = vnode1[vnode2.t];
		if ( !vnode1 ) {
			return 0; // 新虚拟节点和当前的复合虚拟节点不能匹配
		}
	}
	
	let attr1 = vnode1.a || {};
	let attr2 = vnode2.a || {};
	// 标签名不同、或k值不同、或有属性id且不同、或有属性ref且不同、或其中一个是svg标签而另一个不是，肯定不一样
	if ( vnode1.k != vnode2.k || (vnode1.t || vnode2.t) && vnode1.t != vnode2.t
		|| (attr1.id || attr2.id) && attr1.id != attr2.id
		|| (attr1.ref || attr2.ref) && attr1.ref != attr2.ref
		|| (vnode1.g || vnode2.g) && vnode1.g != vnode2.g   // SVG标签判断
		) {
		return 0; 
	}

	// 无法继续判断两者不一致，按相同节点看待
	return 1;
}

// 同一节点，比较先后虚拟节点的属性变更点
function getDiffAttrs(vnode1, vnode2){

	if ( vnode1.x ) {
		return 0; // log('GOOD： SKIP ATTR DIFF')
	}

	let attr1 = vnode1.a || {};
	let attr2 = vnode2.a || {};
	let keys2 = Object.keys(attr2);

	let rs = {};
	let has = 0;
	keys2.forEach(k => {
		if ( attr1[k] != attr2[k] ) {
			if ( k == 'class' ) {
				let oDiff = getDiffClass(attr1[k], attr2[k]);
				if ( oDiff ) {
					rs[k] = oDiff;
					has = 1;
				}
			}else if ( k == $SLOT ) {
				// TODO 虚拟子节点,忽略比较 ????
			}else if ( k == 'style' ) {
				let oDiff = getDiffStyle(attr1[k], attr2[k]);
				if ( oDiff ) {
					rs[k] = oDiff;
					has = 1;
				}
			}else if ( BOOL_PROPS.includes(k) ) {
				// 布尔型属性
				if ( toBoolean(attr1[k]) != toBoolean(attr2[k]) ) {
					rs[k] = toBoolean(attr2[k]);
					has = 1;
				}
			}else{
				rs[k] = attr2[k];
				has = 1;
			}
		}
	});
	return has ? rs : 0;
}

function getDiffClass(class1, class2){
	let obj1 = class1 || {};
	let obj2 = class2 || {};
	let keys2 = Object.keys(obj2);
	
	let rs = {};
	let has = 0;
	keys2.forEach(k => {
		if ( obj1[k] == null ) {
			rs[k] = toBoolean(obj2[k]);
			has = 1;
		}else if ( toBoolean(obj1[k]) != toBoolean(obj2[k]) ) {
			rs[k] = toBoolean(obj2[k]);
			has = 1;
		}
	});
	return has ? rs : null;
}

function getDiffStyle(style1, style2){
	let obj1 = parseStyleToObject(style1);
	let obj2 = parseStyleToObject(style2);
	let keys2 = Object.keys(obj2);
	
	let rs = {};
	let has = 0;
	keys2.forEach(k => {
		if ( obj1[k] == null ) {
			rs[k] = obj2[k];
			has = 1;
		}else if ( obj1[k] != obj2[k] ) {
			rs[k] = obj2[k];
			has = 1;
		}
	});
	return has ? rs : null;
}


