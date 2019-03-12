const bus = require('@gotoeasy/bus');

bus.on('astgen-of-text-node', function(){

    return function (node, context){

        if ( node.type === 'Text' ) {
            return textJsify(node, context);
        }else if ( node.type === 'EscapeExpression' ) {
            return escapeExpressionJsify(node, context);
        }else if ( node.type === 'UnescapeExpression' ) {
            return unescapeExpressionJsify(node, context);
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

// TODO 是否需要转义？
function escapeExpressionJsify(node, context){
    let obj = node.object;                                              // 当前节点数据对象

    let ary = [];
    let text = obj.value.trim();
    text = '(' + text.substring(1, text.length-1) + ')';                // 去除前后大括号{}，换为小括号包围起来确保正确
    ary.push(                   `{ `                                );     
    ary.push(                   `  s: ${text} `                     );  // 一般是动态文字，也可以是静态
    ary.push(                   ` ,k: ${context.keyCounter++} `     );  // 组件范围内的唯一节点标识（便于运行期差异比较优化）
    ary.push(                   `}`                                             );

    return ary.join('\n')
}

function unescapeExpressionJsify(node, context){
    let obj = node.object;                                              // 当前节点数据对象

    let ary = [];
    let text = obj.value.trim();
    text = '(' + text.substring(2, text.length-1) + ')';                // 去除前后大括号{}，换为小括号包围起来确保正确
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
