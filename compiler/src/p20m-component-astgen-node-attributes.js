const bus = require('@gotoeasy/bus');

bus.on('astgen-node-attributes', function(){

    // 标签普通属性生成json形式代码
    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找检查属性节点
        let attrsNode;
        for ( let i=0, nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === 'Attributes' ) {
                attrsNode = nd;
                break;
            }
        }
        if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return '';

        // 生成
        let key, value, comma = '', ary = [];
        ary.push( `{ `);     
        attrsNode.nodes.forEach(node => {
            key = '"' + lineString(node.object.name) + '"';
            if ( node.object.isExpression ) {
                value = parseExpr(node.object.value);
            }else{
                value = '"' + lineString(node.object.value) + '"';
            }

            ary.push( ` ${comma} ${key}: ${value} ` );
            !comma && (comma = ',');
        });
        ary.push( ` } ` );
        
        return ary.join('\n')
    }

}());


function parseExpr(expression){
    let expr = expression.trim();
    expr.startsWith('{') && expr.endsWith('}') && (expr = expr.substring(1, expr.length-1));
    return `(${expr})`;
}


function lineString(str, quote = '"') {
    if ( str == null ) {
        return str;
    }

    let rs = str.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
//    let rs = str.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}

