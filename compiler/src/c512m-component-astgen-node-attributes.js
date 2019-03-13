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
            key = '"' + node.object.name + '"';
            value = node.object.value;                                  // 前面已整理，直接使用即可（astedit-normolize-attribtue-value）

            ary.push( ` ${comma} ${key}: ${value} ` );
            !comma && (comma = ',');
        });
        ary.push( ` } ` );
        
        return ary.join('\n')
    }

}());
