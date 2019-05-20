const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 自关闭标签统一转换为Tag类型节点
    return postobject.plugin(/**/__filename/**/, function(root){

        const OPTS = bus.at('视图编译选项');

        root.walk( OPTS.TypeTagSelfClose, (node, object) => {

            let type = 'Tag';
            let value = object.value;
            let pos = object.pos;
            let tagNode = this.createNode({type, value, pos})

            let tagAttrsNode = node.after();
            if ( tagAttrsNode && tagAttrsNode.type === 'Attributes' ) {
                tagNode.addChild(tagAttrsNode.clone());
                tagAttrsNode.remove();
            }

            node.replaceWith(tagNode);
        });

    });

}());
