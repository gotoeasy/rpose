// ---------------------------
// 虚拟节点比较和差异更新
// ---------------------------
// TODO 事件的差异更新
/**
 * 组件对象的虚拟节点比较及差异更新
 *
 * @param component 组件对象
 * @param vnode 新虚拟节点
 */
function diffRender(component, vnode2){

    // 组件根节点
    let $$el = $$('.' + component.$COMPONENT_ID);
    if ( !$$el.length ) {
        return;                                         // 根节点找不到，通常不应该，多数是DOM节点被其他途径修改了，或是组件就没有节点
    }

    // 新虚拟节点不存在，意欲销毁组件对象
    if ( !vnode2 ) {
        return $$el.remove();                           // 删除
    }

    // 找出原虚拟节点
    let vnode1 = domVnode($$el[0]);
    vnode1.M && (vnode1 = vnode1[vnode2.t]);            // 复合节点时继续深究取出原虚拟节点

    if ( vnode2.m ) {
        return vnode1.o.setState({[$SLOT]: vnode2.c});  // 子组件对象时，交由子组件对象自己去做差异更新(state在diff前已经并入，再传入虚拟子节点以支持slot)
    }

    // 原虚拟节点找不到，或不是同一节点，替换
    let attr1 = (vnode1 || {}).a || {};
    let attr2 = vnode2.a || {};
    if ( !vnode1                                        // 原虚拟节点找不到
        || vnode1.k !== vnode2.k                        // 节点标识不同肯定是不同节点，节点标识相同未必是同一节点
        || vnode1.K != vnode2.K                         // 自定义节点标识不同肯定是不同节点，自定义节点标识相同理应同一节点
		|| vnode1.t !== vnode2.t                        // 标签名不同，肯定不是同一节点
        || attr1.id != attr2.id                         // 自定义的ID不同，肯定不是同一节点
        ) {
        let el = createDom(vnode2, component);
        $$el.replaceWith( el );                         // 替换
        return el;
    }

    // 属性差异比较更新
    let diffAttrs = getDiffAttrs(vnode1, vnode2);
    if ( diffAttrs ) {
        for ( let k in diffAttrs ) {
            vnode1.a[k] = diffAttrs[k];                 // 属性保存到虚拟节点中
            $$el.attr(k, diffAttrs[k]);                 // 属性更新
        }
    }
    
    // 没有@html和@text属性时，继续做子节点的差异比较更新
    !attr1['@html'] && !attr1['@text'] && diffRenderChildern(component, $$el[0], vnode2);
}

function diffRenderChildern(component, parent, parentVnode2){

    let childern1els = [...(parent.childNodes || [])];
    let childern2vns = parentVnode2.c || [];

    // 原节点不存在，直接插入全部新子节点
    if ( !childern1els.length ) {
        return childern2vns.forEach(vn2 => parent.appendChild( createDom(vn2, component) ));
    }

    // 包装成新数组便于打标记比较 (vn：虚拟节点)
    let ary1 = [], ary2 = [];
    childern1els.forEach(el => ary1.push({vn: domVnode(el), el}));
    childern2vns.forEach(vn => ary2.push({vn}));

    let matchAll = 1; // 完全匹配标记
    if ( ary1.length === ary2.length ) {
        // 大多情况下，都是节点没变仅修改属性，针对这种情况优化，直接按下标比较
        for ( let i=0,wv1,wv2; i<ary1.length; i++) {
            wv1 = ary1[i];
            wv2 = ary2[i];
            if ( mabeSameWvnode(wv1, wv2) ) {
                wv1.S = wv2.S = 1;
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
        ary2.forEach(wv => !wv.S && findAndMarkWVnode(ary1, wv));                       // 查找并标记 (找到时都标记S:1)
        ary1 = ary1.filter(wv => wv.S ? 1 : ($$(wv.el).remove() && 0) );                // 原节点没被找出来的全部删除，并从包装数组中删除

        // 原节点被删光时，直接插入全部新子节点
        if ( !ary1.length ) {
            return ary2.forEach(wv=>parent.appendChild( createDom(wv.vn, component)) );
        }
    }


    // 按新虚拟节点顺序更新视图
    let j = 0;
    let wv1 = ary1[j];
    for ( let i=0,wv2; wv2=ary2[i++]; ) {
        if ( !wv2.S ) {
            // 是个新节点
            let el2 = createDom(wv2.vn, component); // 不是所有组件都会渲染返回节点
            el2 && wv1 ? parent.insertBefore(el2, wv1.el) : parent.appendChild(el2);    // 在vnode1节点前插入新子节点(ie会无父节点而出错)，或追加新子节点到尾部
        }else{
            // 是现有节点时，先调整到同一位置
            if ( wv2.wv1 !== wv1 ) {
                // 数组模拟移动，以保持和DOM操作顺序一致
                ary1.splice(j, 0, ary1.splice(ary1.indexOf(wv2.wv1), 1)[0]);            // 修改数组：移动idx元素到j前面
                j++;

                // 真实DOM移动 （TODO ie有问题）
                parent.insertBefore(wv2.wv1.el, wv1.el);                                // 原节点不需要先删除 parent.removeChild(wv2.wv1.el);
            }else{
                // 一样顺序的相同节点，准备继续下一个
                wv1 = ary1[++j];
            }

            // 做差异更新
            if ( wv2.vn.m ) {
                // 是组件标签则调用组件对象做差异更新
                setComponentState(wv2.wv1.vn[wv2.vn.t].o, wv2.vn);                  // 传入新虚拟节点
            }else{
                // 普通节点属性差异更新
                let diffAttrs = getDiffAttrs(wv2.wv1.vn, wv2.vn);                   // 比较属性差异
                if ( diffAttrs ) {
                    for ( let k in diffAttrs ) {
                        wv2.wv1.vn.a[k] = diffAttrs[k];                             // 属性保存到虚拟节点
                        $$(wv2.wv1.el).attr(k, diffAttrs[k]);                       // 更新属性
                    }
                }else if (!wv2.vn.t && wv2.wv1.vn.s != wv2.vn.s ){
                    wv2.wv1.vn.s = wv2.vn.s;                                        // 文本保存到虚拟节点
                    wv2.wv1.el.textContent = wv2.vn.s;                              // 更新文本节点字符串
                }

                if (wv2.vn.e) {
                    for (let k in wv2.vn.e) {
                        removeDomEventListener(wv2.wv1.el, k);                      // 清空原节点全部事件
                        if ( isFunction(wv2.vn.e[k]) ) {
                            $$(wv2.wv1.el).on(k, wv2.vn.e[k] );
                        }else if ( wv2.vn.e[k] != null ) {
                            console.error('invalid event handle:', k, '=', wv2.vn.e[k]);    // 绑定的不是方法
                        }
                    }
                }
            }

        }
    }

    // 继续差异比较子节点（新建的节点会生成，跳过）
    ary2.forEach(wv => {
        if ( wv.S ) {
            if ( wv.vn.m ) {
                setComponentState(wv.wv1.vn[wv.vn.t].o, wv.vn);                         // 组件对象时让组件自己去差异更新
            }else{
                diffRenderChildern(component, wv.wv1.el, wv.vn);
            }
        }
    });

}

function findAndMarkWVnode(wvns1, wv2){
    for ( let i=0,wv1; wv1=wvns1[i++]; ) {
        if ( mabeSameWvnode(wv1, wv2) ) {
            wv1.S = wv2.S = 1;
            return wv2.wv1 = wv1;
        }
    }
}

function mabeSameWvnode(wv1, wv2){
    if ( wv1.S ) {
        return 0;                           // 已标记过的不再匹配
    }

    let vnode1 = wv1.vn, vnode2 = wv2.vn;
    if ( !vnode1 ) {
        return 0;                           // TODO ie时跑进来是这里是怎么回事
    }
    if ( vnode1.M ) {
        vnode1 = vnode1[vnode2.t];
        if ( !vnode1 ) {
            return 0;                       // 新虚拟节点和当前的复合虚拟节点不能匹配
        }
    }
    
    let attr1 = vnode1.a || {};
    let attr2 = vnode2.a || {};
    if ( vnode1.k !== vnode2.k              // 节点标识不同肯定是不同节点，节点标识相同未必是同一节点
        || vnode1.K != vnode2.K             // 自定义节点标识不同肯定是不同节点，自定义节点标识相同理应同一节点
        || vnode1.t !== vnode2.t            // 标签名不同，肯定不是同一节点
        || attr1.id !== attr2.id            // 自定义的ID不同，肯定不是同一节点
        ) {
        return 0; 
    }

    // 无法继续判断两者不一致，按相同节点看待
    return 1;
}

// 同一节点，比较前后虚拟节点的属性变更点
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
        if ( attr1[k] !== attr2[k] ) {
            if ( k === 'class' ) {
                // class时继续特殊比较
                let oDiff = getDiffClass(attr1[k], attr2[k]);
                if ( oDiff ) {
                    rs[k] = oDiff;
                    has = 1;
                }
            }else if ( k === 'style' ) {
                // style时继续特殊比较
                let oDiff = getDiffStyle(attr1[k], attr2[k]);
                if ( oDiff ) {
                    rs[k] = oDiff;
                    has = 1;
                }
            }else if ( BOOL_PROPS.includes(k) ) {
                // 布尔型属性时继续特殊比较
                if ( toBoolean(attr1[k]) !== toBoolean(attr2[k]) ) {
                    rs[k] = toBoolean(attr2[k]);
                    has = 1;
                }
            }else{
                // 普通属性或$SLOT属性不一样
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
        }else if ( toBoolean(obj1[k]) !== toBoolean(obj2[k]) ) {
            rs[k] = toBoolean(obj2[k]);
            has = 1;
        }
    });
    return has ? rs : null;
}

function getDiffStyle(style1, style2){
    let obj1 = parseStyleToObject(style1);      // 函数parseStyleToObject在m200-dom.js中定义
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

function setComponentState(component, vnode){
    component.setState( Object.assign({}, vnode.a, vnode.e, {[$SLOT]: vnode.c}) );  // 传入属性、事件、子节点
}

