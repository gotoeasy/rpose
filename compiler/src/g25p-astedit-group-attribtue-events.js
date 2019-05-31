const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 处理标签中指定类型的属性，提取后新建节点管理
    // 标准标签的事件统一分组
    // 标签节点下新建Events节点存放
    return postobject.plugin(/**/__filename/**/, function(root){

        root.walk( 'Tag', (node) => {

            if ( !node.object.standard ) return;                                        // 非标准标签，跳过
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
                bus.at('是否HTML标准事件名', nd.object.name) && ary.push(nd);            // 找到
            });

            if ( !ary.length ) return;                                                  // 没有找到相关节点，跳过

            // 查找/创建事件组节点
            let groupNode = getEventsNode(node);
            if ( !groupNode ) {
                groupNode = this.createNode( {type: 'Events'} );
                node.addChild(groupNode);
            }

            // 创建节点保存
            ary.forEach(nd => {
                let cNode = nd.clone();
                cNode.type = 'Event';
                cNode.object.type = 'Event';
                groupNode.addChild(cNode);
                nd.remove();    // 删除节点
            });
            node.addChild(groupNode);

        });

    });

}());

function getEventsNode(tagNode){
    let nodes = tagNode.nodes || [];
    for ( let i=0,node; node=nodes[i++]; ) {
        if ( node.type === 'Events' ) {
            return node;
        }
    }
}

