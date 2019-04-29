const bus = require('@gotoeasy/bus');

bus.on('astgen-node-class', function(){

    // 标签类属性生成json属性值形式代码
    // "abc def {bar:!bar}" => {class:{abc:1, def:1, bar:!bar}}
    // 修改类名
    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找Class属性节点
        let classNode;
        for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'Class' ) {
                classNode = nd;
                break;  // 找到
            }
        }
        if ( !classNode || !classNode.object.value ) return '';             // 没有类属性节点或没有类属性值，返回空白

        // 生成
        return classStrToObjectString(classNode.object.value, context);
    }

}());


function classStrToObjectString(clas, context){

    // TODO 含大括号冒号的复杂表达式
    let oCsslibPkgs = context.result.oCsslibPkgs;
    let oRs = {};
    clas = clas.replace(/\{.*?\}/g, function(match){
        let str = match.substring(1, match.length-1);   // {'xxx': ... , yyy: ...} => 'xxx': ... , yyy: ...
        
        let idx, cls, expr;
        while ( str.indexOf(':') > 0 ) {
            idx = str.indexOf(':');
            cls = str.substring(0, idx).replace(/['"]/g, '');   // cls

            expr = str.substring(idx+1);
            let idx2 = expr.indexOf(':');
            if ( idx2 > 0 ) {
                expr = expr.substring(0, idx2);
                expr = expr.substring(0, expr.lastIndexOf(','));    // expr
                str = str.substring(idx + 1 + expr.length + 1);     // 更新临时变量
            }else{
                str = '';
            }

            expr = expr.replace(/\\/g, '皛');                       // 补丁案 ...... 把class里表达式的斜杠临时替换掉，避免JSON处理时不认正则表达式的转义字符，在输出代码时替换回来
            oRs[bus.at('哈希样式类名', context.input.file, getClassPkg(cls, oCsslibPkgs))] = '@(' + expr + ')@';
        }

        return '';
    });
    
    let ary = clas.split(/\s/);
    for ( let i=0; i<ary.length; i++) {
        ary[i].trim() && (oRs[bus.at('哈希样式类名', context.input.file, getClassPkg(ary[i], oCsslibPkgs))] = 1);
    }

    let rs = JSON.stringify(oRs).replace(/('@|@'|"@|@")/g, '');
    rs = rs.replace(/皛/g, '\\');                                   // 补丁案 ...... 把class里表达式的【皛】替换回斜杠，以达到正常输出正则表达式的目的
    return rs;
}

function getClassPkg(cls, oCsslibPkgs){
    let ary = cls.trim().split('@');
    if ( ary.length > 1 ){
        return ary[0] + '@' + oCsslibPkgs[ary[1]];
    }

    return ary[0];
}
