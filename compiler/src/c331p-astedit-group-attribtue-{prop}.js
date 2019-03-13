const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 处理标签中指定类型的属性，提取后新建节点管理
    // 无属性值的对象表达式统一分组，如< div {prop1} {prop2} >
    // 标签节点下新建ExpressionAttributes节点存放
    return postobject.plugin(__filename, function(root, context){

        root.walk( 'Tag', (node, object) => {

            if ( !node.nodes || !node.nodes.length ) return;                            // 节点没有定义属性，跳过

            // 查找Attributes
            let attrsNode;
            for ( let i=0,nd; nd=node.nodes[i++]; ) {
                if ( nd.type === 'Attributes' ) {
                    attrsNode = nd;
                    break;
                }
            }
            if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return;    // 节点没有定义属性，跳过

            // 查找目标属性节点
            let ary = [];
            attrsNode.nodes.forEach(nd => {
                !nd.object.hasOwnProperty('value') && ary.push(nd);                     // 找到，没有value属性的就是（astedit-normalize-group-attribute中已统一整理）
            });

            if ( !ary.length ) return;                                                  // 没有找到相关节点，跳过

            // 创建节点保存
            let groupNode = this.createNode( {type: 'ExpressionAttributes'} );
            ary.forEach(nd => {
                let cNode = nd.clone();
                cNode.type = 'ExpressionAttribute';
                cNode.object.type = 'ExpressionAttribute';
                groupNode.addChild(cNode);
                nd.remove();    // 删除节点
            });
            node.addChild(groupNode);

        });

    });

}());
