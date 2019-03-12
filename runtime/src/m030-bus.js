// ---------------------------
// 总线
// ---------------------------
const BUS = (()=>{
	let keySetFn = {}; // key:Set{fn}

	// 安装事件函数
	let on = (key, fn) => {
        if ( !key || !isFunction(fn) ) return;
        key = toLowerCase(key);
        (keySetFn[key] || (keySetFn[key] = new Set)).add(fn);
    };

	// 卸载事件函数
	let off = (key, fn) => {
        key = toLowerCase(key);
		let setFn = keySetFn[key];
		setFn && (fn ? setFn.delete(fn) : delete keySetFn[key]);
	};

	// 安装事件函数，函数仅执行一次
	let once = (key, fn) => {
		fn['ONCE_' + toLowerCase(key)] = 1; // 加上标记
		on(key, fn);
	};

	// 通知执行事件函数
	let at = (key, ...args) => {
        key = toLowerCase(key);
		let rs, setFn = keySetFn[key];
		if ( setFn ) {
			setFn.forEach(fn => {
				fn['ONCE_' + key] && setFn.delete(fn) && delete fn['ONCE_' + key]; // 若是仅执行一次的函数则删除关联
				rs=fn(...args); // 常用于单个函数的调用，多个函数时返回的是最后一个函数的执行结果
			});
			!setFn.size && off(key);
		}
		return rs;
	};

	// 安装些默认事件处理
    on('window.onload', e => {
        $$('.pre-render').addClass('loaded');              // onload时添加loaded类
        setTimeout(()=>$$('.pre-render').remove(), 5000);  // 5秒后删除节点
    });
	let handler = e => {
        // 触发后解除绑定
        at('window.onload', e);
        window.removeEventListener ? window.removeEventListener('load', handler) : window.detachEvent("onload", handler);
        off('window.onload');
    };
	window.addEventListener ? window.addEventListener('load', handler, false) : window.attachEvent("onload", handler);

	return {on: on, off: off, once: once, at: at};
})();
