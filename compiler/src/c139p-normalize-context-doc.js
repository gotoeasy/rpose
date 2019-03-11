const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
	return postobject.plugin(__filename, function(root, context){

        let doc = context.doc;

        // 适当整理
        doc.api = parseBlockApi(doc.api);                           // [api]解析为对象，按键值解析
        doc.mount && (doc.mount = doc.mount.trim());                // [mount]有则去空白

    });

}());


function parseBlockApi(api){
	let rs = {};
	let lines = (api == null ? '' : api.trim()).split('\n');
	lines.forEach(line => {
		let key, value, idx = line.indexOf('=');                    // 等号和冒号，谁在前则按谁分隔
        idx < 0 && (idx = line.indexOf(':'))
        if ( idx < 0) return;

        key = line.substring(0, idx).trim();
        value = line.substring(idx+1).trim();

        idx = value.lastIndexOf('//');
        idx >= 0 && (value = value.substring(0, idx).trim());       // 去注释，无语法分析，可能会误判

        if ( /^option[\-]?keys$/i.test(key) ) {
            key = 'optionkeys';
            value = value.split(/[,;]/).map(v=>v.trim());
        }else if ( /^state[\-]?keys$/i.test(key) ) {
            key = 'statekeys';
            value = value.split(/[,;]/).map(v=>v.trim());
        }else if ( /^pre[\-]?render$/i.test(key) ) {
            key = 'prerender';
        }
		rs[key] = value;
	});
	return rs;
}

