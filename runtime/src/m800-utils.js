// ---------------------------
// 常用工具方法
// ---------------------------

// html特殊字符转义
// < = &lt;
// > = &gt;
// " = &quot;
//   = &nbsp;
// & = &amp;
function escapeHtml(html){
	if ( typeof html == 'string' ) {
//		return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		return html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
	return html;
}

function unescapeHtml(str){
	if ( typeof str == 'string' ) {
		return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
	}
	return str;
}

function isEmpty(obj) {
	if ( !obj ) {
		return true;
	}
	if ( isPlainObject(obj) ) {
		for ( let k in obj ) {
			return false;
		}
		return true;
	}
	return !!obj;
}


function uid(prefix) {
	if ( prefix ) {
		!uid[prefix] && (uid[prefix] = 1);
		return prefix + uid[prefix]++;
	}
	!uid.n && (uid.n = 1);
	return uid.n++;
}

// 直接运算为false则返回false，字符串（不区分大小写）‘0’、‘f’、‘false’、‘n’、‘no’ 都为false，其他为true
function toBoolean(arg){
	if ( !arg ) return false;
	if ( !isString(arg) ) return true;
	return !/^(0|false|f|no|n)$/i.test((arg + '').trim());
}

// 深复制对象属性，与Object.assign(...)的区别在于
// 1) 如果最后一个参数为数组，则该数组限定了复制的属性范围；如果是null等false值，则不复制；其他情况则复制所有属性
// 2) 第一参数null时返回null不报错，其他参数null时忽略
// 3) 对属性class做特殊处理
// 4) 深度复制
function extend(...args){
	if ( !args.length || isArray(args[0]) || !args[0] ) return null;

	let keys = args[args.length-1];
	if ( !keys ) return;

	let oOrig = args[0];
	oOrig.class = classToPlantObject(oOrig.class);

	if ( isArray(keys) ) {
		for ( let i=0, oCopy; i<args.length-1; i++ ) {
			oCopy = args[i];
			if ( oOrig !== oCopy && isPlainObject(oCopy) ) {
				keys.forEach(k => {
					if ( oCopy[k] !== undefined ) {
						k == 'class' ? Object.assign(oOrig.class, classToPlantObject(oCopy[k])) : (oOrig[k] = _copyObjectValue(oCopy[k]));
					}
				});
			}
		}
	}else{
		for ( let i=1, oCopy; i<args.length; i++ ) {
			oCopy = args[i];
			if ( oOrig !== oCopy && isPlainObject(oCopy) ) {
				for ( let k in oCopy ) {
					k == 'class' ? Object.assign(oOrig.class, classToPlantObject(oCopy[k])) : (oOrig[k] = _copyObjectValue(oCopy[k]));
				}
			}
		}
	}
	return oOrig;
}

// 浅复制对象属性，与Object.assign(...)的区别在于
// 1) 如果最后一个参数为数组，则该数组限定了复制的属性范围；如果是null等false值，则不复制；其他情况则复制所有属性
// 2) 第一参数null时返回null不报错，其他参数null时忽略
// 3) 对属性class做特殊处理
function assign(...args){
	if ( !args.length || isArray(args[0]) || !args[0] ) return null;

	let keys = args[args.length-1];
	if ( !keys ) return;

	let oOrig = args[0];
	oOrig.class = classToPlantObject(oOrig.class);

	if ( isArray(keys) ) {
		for ( let i=1, oCopy; i<args.length-1; i++ ) {
			oCopy = args[i];
			if ( oOrig !== oCopy && isPlainObject(oCopy) ) {
				keys.forEach(k => {
					if ( oCopy[k] !== undefined ) {
						k == 'class' ? Object.assign(oOrig.class, classToPlantObject(oCopy[k])) : (oOrig[k] = oCopy[k]);
					}
				});
			}
		}
	}else{
		for ( let i=1, oCopy; i<args.length; i++ ) {
			oCopy = args[i];
			if ( oOrig !== oCopy && isPlainObject(oCopy) ) {
				for ( let k in oCopy ) {
					k == 'class' ? Object.assign(oOrig.class, classToPlantObject(oCopy[k])) : (oOrig[k] = oCopy[k]);
				}
			}
		}
	}
	return oOrig;
}

// "abc def" => {abc:1, def:1}
function classToPlantObject(str){
	if ( str == null ) {
		return {};
	}
	if ( isPlainObject(str) ) {
		return str;
	}

	let ary = str.split(/\s/);
	let objCls = {};
	ary.forEach(v => v.trim() && (objCls[v]=1));
	return objCls;
}

function _copyObjectValue(obj) {
	if ( !obj || obj.$COMPONENT_ID ) {
		return obj; // undefined、null、false、‘’、0、组件对象
	}

	if ( isPlainObject(obj) ) {
		let rs = {};
		for (var key in obj){
			rs[key] = _copyObjectValue(obj[key]);
		}
		return rs;
	}
	if ( isArray(obj) ) {
		let rs = [];
		for (var i=0;i<obj.length;i++){
			rs[i] = _copyObjectValue(obj[i]);
		}
		return rs;
	}
	if ( isDate(obj) ) {
		return new Date(obj.getTime());
	}
	if ( isMap(obj) ) {
		return new Map(obj); // Map中的值不一定合适克隆，仅简单复制键值
	}
	if ( isSet(obj) ) {
		return new Set(obj);
	}

/*
	// RegExp不常用，更不常修改，一般不克隆
	if ( isRegExp(obj) ) {
		let flgs = '';
		obj.ignoreCase && (flgs += 'i')
		obj.multiline && (flgs += 'm')
		obj.global && (flgs += 'g')
		return new RegExp(obj.source, flgs);
	}
*/

	return obj;
}
