const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('astgen-node-class', function(){

    // 标签类属性生成json属性值形式代码
    // "abc def {bar:!bar}" => {class:{abc:1, def:1, bar:!bar}}
    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找检查事件属性节点
        let classNode;
        for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'Class' ) {
                classNode = nd;
                break;  // 找到
            }
        }
        if ( !classNode || !classNode.object.value ) return '';             // 没有类属性节点或没有类属性值，返回空白

        // 生成
        return classStrToObjectString(classNode.object.value, context.input.file);
    }

}());


function classStrToObjectString(clas, srcFile){

    // TODO 含大括号冒号的复杂表达式
    let oRs = {};
    clas = clas.replace(/\{.*?\}/g, function(match){
        let str = match.substring(1, match.length-1);   // {'xxx': ... , yyy: ...} => 'xxx': ... , yyy: ...
        
        let idx, key, val;
        while ( str.indexOf(':') > 0 ) {
            idx = str.indexOf(':');
            key = str.substring(0, idx).replace(/['"]/g, '');   // key

            val = str.substring(idx+1);
            let idx2 = val.indexOf(':');
            if ( idx2 > 0 ) {
                val = val.substring(0, idx2);
                val = val.substring(0, val.lastIndexOf(','));   // val
                str = str.substring(idx + 1 + val.length + 1);                     // 更新临时变量
            }else{
                str = '';
            }
            oRs[bus.at('哈希样式类名', srcFile, key.trim())] = '@(' + val + ')@';
        }

        return '';
    });
    

	let ary = clas.split(/\s/);
	for ( let i=0; i<ary.length; i++) {
		ary[i].trim() && (oRs[bus.at('哈希样式类名', srcFile, ary[i].trim())] = 1);
	}

	return JSON.stringify(oRs).replace(/('@|@'|"@|@")/g, '');
}

