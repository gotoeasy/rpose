// ---------------------------
// 常用DOM操作封装
// ---------------------------

// 对象常量: 简易封装DOM属性操作
const DomAttrHandle = (function(){
	let callbacks = {};
	let on = (key, fn) => callbacks[toLowerCase(key)] || (callbacks[toLowerCase(key)] = fn);

	// val为undefined时，意思是要取值，传入则是要设值
	let at = (el, prop, val) => (callbacks[toLowerCase((el.tagName + '.' + prop))] || callbacks[toLowerCase(prop)] || callbacks['*']).apply(this, [el, prop, val]);		// 优先级： tag.prop > prop > *

	// ------------------
	// 普通属性存取
	on('*', (el, prop, val) => isFunction(val) || val==null || prop.startsWith('$') ? el.getAttribute(prop) : el.setAttribute(prop, val) ); // 不支持值为函数的设定，按取值处理，属性名$开头时仅取值（非法属性名，但又常用于内部特殊判断用途）

	// ------------------
	// 特殊属性存取定义(简单起见应付常用属性，必要时具体定义) ['autofocus', 'hidden', 'readonly', 'disabled', 'checked', 'selected', 'multiple', 'translate', 'draggable', 'noresize']
	BOOL_PROPS.forEach(k => on(k, (el, prop, val) => val===undefined ? el[k] : (el[k]=toBoolean(val)) ) ); // on('autofocus', (el, prop, val) => val===undefined ? el.autofocus : (el.autofocus=toBoolean(val)) );

	on('value', (el, prop, val) => val===undefined ? el.value : (el.value=(val==null?'':val)) );

	on('innerHTML', (el, prop, val) => val===undefined ? el.innerHTML : (el.innerHTML=(val==null?'':val)) );
	on('innerTEXT', (el, prop, val) => val===undefined ? el.textContent : (el.textContent=(val==null?'':val)) );
	on('textcontent', (el, prop, val) => val===undefined ? el.textContent : (el.textContent=(val==null?'':val)) );

	on('image.src', (el, prop, val) => val===undefined ? el.src : (el.src=val) );

	// class
	on('class', (el, prop, val) => {
		if ( val===undefined ) {
			return el.className;
		}
		if ( isPlainObject(val) ) {
			for ( let key in val ) {
				toBoolean(val[key]) ? $$(el).addClass(key) : $$(el).removeClass(key); // {'class-name': true}
			}
		}else{
			$$(el).addClass(val);
		}
	} );

	on('@show', (el, prop, val) => val ? $$(el).removeClass('hidden') : $$(el).addClass('hidden') );

	// style .... 有必要支持?
	on('style', (el, prop, val) => {
		if ( val===undefined ) {
			return el.getAttribute('style');
		}

		let oStyle = parseStyleToObject(val);
		for ( let key in oStyle ) {
			el.style[key] = oStyle[key];
		}
	} );

	return {at: at};
})();

function parseStyleToObject(style=''){
	
	// 对象时认为key应该都是合法的style属性: {borderColor: 'red', webkitAppearance: 'button', minWidth: ''}，值空白起到删除的作用
	if ( isPlainObject(style) ) {
		return style;
	}

	let rs = {};
	// border-color: red; -webkit-appearance: button; => ["border-color: red", " -webkit-appearance: button"]
	let ary = style.split(';').filter(v=>v.trim()!='');
	ary.forEach(v=>{
		let kv = v.split(':').filter(v=>v.trim()!=''), key;
		if ( kv.length == 2 ) {
			// key: border-color => borderColor, -webkit-appearance => webkitAppearance
			key = toLowerCase(kv[0]).split('-').filter(v=>v.trim()!='').map((v,i)=>i?(v.charAt(0).toUpperCase()+v.substring(1)):v).join('');
			rs[key] = kv[1].trim(); // borderColor = red
		}
	});
	return rs;
}

// 选择器 $$('.xxxx')
function $$(selector, context){

	if ( typeof selector == 'object' ) {
		return new Dom(selector);
	}

	let doc = context || document;
	let byId = selector.substring(0, 1) == '#';
	let qs;


	// 按ID查询，有一个便是
	if ( byId ) {
		qs = document.getElementById(selector.substring(1));
		return new Dom(qs ? [qs] : []);
	}

	if ( doc instanceof Dom ) {
		let ary = [], qs;
		if ( byId ) {
			for ( let i=0; i<doc.length; i++ ) {
				qs = doc[i].querySelectorAll(selector);
				for ( let j=0; j<qs.length; j++ ) {
					ary.push(qs[j]); // 按class查询，有一个算一个
				}
			}
		}
		return new Dom(ary);
	} 

	return new Dom(doc.querySelectorAll(selector));
}

// DOM操作
function Dom(queryResult){

	let els = [];
	
	// queryResult 保存到 els, queryResult可能是单纯文本节点或包含文本节点
	if ( queryResult ) {
		if ( queryResult.nodeType ) {
			els[0] = queryResult; // 单个节点
		}else if ( queryResult.length ) {
			for ( let i=0; i<queryResult.length; i++ ) {
				queryResult[i] && els.push(queryResult[i]);
			}
		}
	}

	// els暴露为属性length和下标
	this.length = els.length;
	for ( let i=0; i<els.length; i++ ) {
		this[i] = els[i];
	}

	// ---------------------------
	// 遍历 $$('.xxxx').forEach( (v,i)=>{...} )
	this.forEach = function (fn){
		els.forEach(fn);
		return this;
	}

	// ---------------------------
	// 节点替换 $$('.xxxx').replaceWith(element/fragment)
	this.replaceWith = function (element){
		let el, parent, theOne;

		// 留一个有效节点，其余删除
		while ( els.length ) {
			el = els.pop();
			parent = el.parentNode;
			parent && (theOne ? parent.removeChild(el) : (theOne = el));
		}

		// 替换保留的节点
		if ( theOne ) {
			theOne.parentNode.insertBefore(element, theOne);
			theOne.parentNode.removeChild(theOne);
		}

		return this;
	}

	// ---------------------------
	// 事件绑定 $$('.xxxx').on('click', fn)
	this.on = function (name, fn){
		els.forEach(el => {
            el.addEventListener ? el.addEventListener(name, fn, false) : el.attachEvent ? el.attachEvent("on" + name, fn) : el["on" + name] = fn;
            // addDomEventListener(el, name, fn); // 有缺点待解决
        });
		return this;
	}

	// ---------------------------
	// 添加class $$('.xxxx').addClass('js-active')
	this.addClass= function (name){

        if ( !name ) {
            return this;
        }

        name = name.replace(/\./g, '');
        for ( let i=0,el; i<els.length; i++ ) {
            el = els[i];
            if ( !el ) continue;

            if (IS_IE){
                // The classList property is not supported by IE9 and lower. IE11 still bug on classList, it does not support classList on SVG element
                if (!el.className){
                    el.className = name;
                }else{
                    var ary = el.className.split(' ');
                    if (ary.indexOf(name) >= 0) {
                        return this;
                    }
                    ary.push(name);
                    el.className = ary.join(' ');
                }
            }else{
                // 单纯的文本节点没有classList
                let nms = name.split(/\s+/);
                for ( let i=0,nm; nm=nms[i++]; ) {
                    !el.classList.contains(nm) && el.classList.add(nm);
                }
            }
        }

		return this;
	}

	// ---------------------------
	// 删除class $$('.xxxx').removeClass('js-active')
	this.removeClass = function (name){ 
		name && (name = name.replace(/\./g, '')) && els.forEach(el => {
			if (IS_IE){
				var ary = el.className.split(' ');
				var idx = ary.indexOf(name);
				if (idx >= 0) {
					ary.slice(idx, 1);
					el.className = ary.join(' ');
				}
			}else{
				let nms = name.split(/\s+/);
				nms.forEach(nm => el.classList.remove(nm))
			}
		});
		return this;
	}

	// ---------------------------
	// 存取属性 $$('.xxxx').attr('name', 'value')
	this.attr = function (name, value){
		if ( !els.length ) {
			return value == null ? null : this;
		}

		let rs;
		for ( let i=0; i<els.length; i++ ) {
			if ( value == null ) {
				return DomAttrHandle.at(els[0], name); // 取值时仅返回首个节点属性值
			}
			DomAttrHandle.at(els[i], name, value);		// 设值时全部节点都设定
		}

		return this;
	}


	// ---------------------------
	// 删除子节点 $$('.xxxx').removeChildren()
    this.removeChildren = function () {
		els.forEach(el => {
			try {
				el.innerHTML = "";
			} catch (e) {
				// TBODY，IE <= 9
				for (;el.firstChild; ) el.removeChild(el.firstChild);
			}
		});
		return this;
    }

	// ---------------------------
	// 删除节点 $$('.xxxx').remove()
    this.remove = function () {
		els.forEach( el => el.parentNode.removeChild(el) );
		return this;
    }

	return this;
}


/*
// DOM事件
function addDomEventListener(el, name, fn){
    domEventListener(el, name, fn);
    addDocumentEventListener(name);
	// el.addEventListener ? el.addEventListener(name, fn, false) : el.attachEvent ? el.attachEvent("on" + name, fn) : el["on" + name] = fn;
}
function domEventListener(el, name, fn){
	let map = domEventListener.m = domEventListener.m || new WeakMap(); // el: {name: Set(...fn) }

	let oFn;
	if ( !fn ) {
		oFn = map.get(el) || {};
		return oFn[name];
	}

	!map.has(el) && map.set(el, {});
	oFn = map.get(el);
	let set = oFn[name] || (oFn[name] = new Set());
	set.add(fn);
}
function fnDocumentEventListener(event) {
	let el = event.target || event.srcElement;
	let fns = domEventListener(el, event.type);
	fns && fns.forEach(fn=>fn(event));
}
function addDocumentEventListener(name){
	if ( !addDocumentEventListener[name] ) {
		addDocumentEventListener[name] = 1;
		document.addEventListener ? document.addEventListener(name, fnDocumentEventListener, false)	: document.attachEvent("on" + name, fnDocumentEventListener);

	}
}
*/