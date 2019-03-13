const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 合并属性到新的Attributes节点
    return postobject.plugin(__filename, function(root, context){

        // 键=值的三个节点，以及单一键节点，统一转换为一个属性节点
        root.walk( 'AttributeName', (node, object) => {
            let eqNode = node.after();
            if ( eqNode && eqNode.type === '=' ) {
                // 键=值的三个节点
                let valNode = eqNode.after();
                if ( !valNode || !valNode.type === 'AttributeValue' ) {
                    throw new Err('missing attribute value'); // 已检查过，不应该出现
                }

                if ( object.value.startsWith('{') && object.value.endsWith('}') && !object.value.endsWith('\\}') ) {
                    // 键值属性的属性名不支持表达式
                    throw new Err('unsupport expression on attribute name', {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                }

                let oAttr = {type: 'Attribute', name: object.value, value: valNode.object.value, loc: {start: object.loc.start, end: valNode.object.loc.end}}
                let attrNode = this.createNode(oAttr);
                node.replaceWith(attrNode);
                eqNode.remove();
                valNode.remove();

            } else {
                // 单一键节点
                let oAttr = {type: 'Attribute', name: object.value, value: true, loc: object.loc}
                if ( object.value.startsWith('{') && object.value.endsWith('}') && !object.value.endsWith('\\}') ) {
                    delete oAttr.value;     // 无值的对象表达式，如 <div {prop}>
                }
                let attrNode = this.createNode(oAttr);
                node.replaceWith(attrNode);
            }

        });

        // 多个属性节点合并为一个标签属性节点
        root.walk( 'Attribute', (node, object) => {
            if ( !node.parent ) return;           // 跳过已删除节点

            let ary = [node];
            let nextNode = node.after();
            while ( nextNode && nextNode.type === 'Attribute' ) {
                ary.push(nextNode);
                nextNode = nextNode.after();
            }

            let attrsNode = this.createNode({type:'Attributes'});
            node.before(attrsNode);
            ary.forEach(n => {
                attrsNode.addChild(n.clone());
                n.remove();
            });

        });

    });

}());
