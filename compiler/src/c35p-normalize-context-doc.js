const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let doc = context.doc;

        // 适当整理
        doc.api = parseBlockApi(doc.api);                           // [api]解析为对象，按键值解析
        doc.mount && (doc.mount = doc.mount.trim());                // [mount]有则去空白

    });

}());


function parseBlockApi(api){

    let rs = {strict: true};                                        // 默认严格匹配样式库模式

    let lines = (api == null ? '' : api.trim()).split('\n');
    lines.forEach(line => {
        let key, value, idx = line.indexOf('=');                    // 等号和冒号，谁在前则按谁分隔
        idx < 0 && (idx = line.indexOf(':'))
        if ( idx < 0) return;

        key = line.substring(0, idx).trim();
        value = line.substring(idx+1).trim();

        idx = value.lastIndexOf('//');
        idx >= 0 && (value = value.substring(0, idx).trim());       // 去注释，无语法分析，可能会误判

        if ( /^option[-]?keys$/i.test(key) ) {
            key = 'optionkeys';
            value = value.split(/[,;]/).map(v=>v.trim());
            rs[key] = value;
        }else if ( /^state[-]?keys$/i.test(key) ) {
            key = 'statekeys';
            value = value.split(/[,;]/).map(v=>v.trim());
            rs[key] = value;
        }else if ( /^pre[-]?render$/i.test(key) ) {
            key = 'prerender';
            rs[key] = value;
        }else if ( /^desktop[-]?first$/i.test(key) ) {
            key = 'desktopfirst';                                   // 移动优先时，min-width => max-width => min-device-width => max-device-width => other;桌面优先时，max-width => max-device-width => min-width => min-device-width => other
            rs[key] = toBoolean(value);
        }else if ( /^mobile[-]?first$/i.test(key) ) {
            key = 'desktopfirst';
            rs[key] = !toBoolean(value);
        }else if ( /^strict$/i.test(key) ) {
            key = 'strict';
            rs[key] = toBoolean(value);
        }else{
            rs[key] = value;
        }
    });
    
    return rs;
}

// 直接运算为false则返回false，字符串（不区分大小写）‘0’、‘f’、‘false’、‘n’、‘no’ 都为false，其他为true
function toBoolean(arg){
	if ( !arg ) return false;
	if ( typeof arg !== 'string' ) return true;
	return !/^(0|false|f|no|n)$/i.test((arg + '').trim());
}
