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
                value = bus.at('表达式代码转换', node.object.value);
            }else if (typeof node.object.value === 'string'){

                let eventName = node.object.name.toLowerCase();
                if ( !tagNode.object.standard && bus.at('是否HTML标准事件名', eventName) && !node.object.isExpression  ) {
                    // 组件上的标准事件属性，支持硬编码直接指定方法名 （如果在methods中有定义，顺便就办了，免得一定要写成表达式）
                    let fnNm = node.object.value.trim();
                    if ( context.script.Method[fnNm] ) {
                        // 能找到定义的方法则当方法处理
                        value = `this.${fnNm}`;                                // fnClick => this.fnClick
                    }else{
                        // 找不到时，按普通属性处理
                        value = '"' + lineString(node.object.value) + '"';
                    }
                }else{
                    value = '"' + lineString(node.object.value) + '"';
                }

            }else{
                value = node.object.value;
            }

            ary.push( ` ${comma} ${key}: ${value} ` );
            !comma && (comma = ',');
        });
        ary.push( ` } ` );
        
        return ary.join('\n')
    }

}());


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

