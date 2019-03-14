const bus = require('@gotoeasy/bus');

bus.on('astgen-node-text', function(){

    return function (node, context){

        const OPTS = bus.at('视图编译选项');

        if ( node.type === OPTS.TypeText ) {
            return textJsify(node, context);
        }else if ( node.type === OPTS.TypeExpression ) {
            return expressionJsify(node, context);
        }

        return '';
    }

}());

function textJsify(node, context){
    let obj = node.object;                                              // 当前节点数据对象

    let ary = [];
    let text = '"' + lineString(obj.value) + '"';                       // 按双引号转换
    ary.push(                   `{ `                                );     
    ary.push(                   `  s: ${text} `                     );  // 静态文字
    ary.push(                   ` ,k: ${context.keyCounter++} `     );  // 组件范围内的唯一节点标识（便于运行期差异比较优化）
    ary.push(                   `}`                                             );

    return ary.join('\n')
}

function expressionJsify(node, context){
    let obj = node.object;                                              // 当前节点数据对象

    let ary = [];
    let text = obj.value.replace(/^\s*\{/, '(').replace(/\}\s*$/, ')'); // 去除前后大括号{}，换为小括号包围起来确保正确 // TODO 按选项设定替换
    ary.push(                   `{ `                                );     
    ary.push(                   `  s: ${text} `                     );  // 一般是动态文字，也可以是静态
    ary.push(                   ` ,k: ${context.keyCounter++} `     );  // 组件范围内的唯一节点标识（便于运行期差异比较优化）
    ary.push(                   `}`                                             );

    return ary.join('\n')
}



function lineString(str, quote = '"') {
    if ( str == null ) {
        return str;
    }

    let rs = str.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}
