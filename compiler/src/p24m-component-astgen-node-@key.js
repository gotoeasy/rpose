const bus = require('@gotoeasy/bus');

bus.on('astgen-node-@key', function(){

    // 转换处理指令节点 @key 取其值作为最终K属性值
    return function (tagNode){
        if ( !tagNode.nodes ) return '';

        // 查找检查事件属性节点
        let atkeyNode;
        for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
            if ( nd.type === '@key' ) {
                atkeyNode = nd;
                break;  // 找到
            }
        }
        if ( !atkeyNode ) return '';

        let value = atkeyNode.object.value;
        if ( atkeyNode.object.isExpression ) {
            value = bus.at('表达式代码转换', value);                // { abcd } => (abcd)
        }else{
            value = '"' + lineString((value + '').trim()) + '"';    // 硬编码的强制转为字符串
        }
        
        return value;
    }

}());

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
