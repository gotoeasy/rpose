const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 自关闭标签统一转换为Tag类型节点
    return postobject.plugin(__filename, function(root, context){

        root.walk( 'TagSelfClose', (node, object) => {

            let type = 'Tag';
            let value = object.value;
            let loc = object.loc;
            let tagNode = this.createNode({type, value, loc})

            let tagAttrNode = node.after();
            if ( tagAttrNode && tagAttrNode.type === 'Attributes' ) {
                tagNode.addChild(tagAttrNode.clone());
                tagAttrNode.remove();
            }

            node.replaceWith(tagNode);
        });

    });

}());
