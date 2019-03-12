const bus = require('@gotoeasy/bus');

bus.on('astgen-of-attributes-node', function(){

    return function (tagNode, context){
        if ( !tagNode.nodes ) return '';

        // 查找检查属性节点
        let attrsNode;
        for ( let i=0; attrsNode=tagNode.nodes[i++]; ) {
            if ( attrsNode.type === 'Attributes' ) {
                break;
            }
        }
        if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return '';

        // 生成
        let key, value, comma = '', ary = [];
        ary.push( `{ `);     
        attrsNode.nodes.forEach(node => {
            key = '"' + lineString(node.object.name) + '"';
            value = node.object.value;
            if ( /^\s*\{=/.test(value) ) {
                value = value.trim();
                value = '(' + value.substring(2, value.length-1) + ')';
            }else if ( /^\s*\{/.test(value) ) {
                value = value.trim();
                value = '(' + value.substring(1, value.length-1) + ')';
            }else{
                value = '"' + lineString(value) + '"';
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
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}
