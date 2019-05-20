const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理标签中指定类型的属性，提取后新建节点管理
    // 处理标签中的 @taglib 属性
    return postobject.plugin(/**/__filename/**/, function(root, context){

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
            if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return;    // 没有相关属性节点，跳过

            // 查找目标属性节点
            let ary = [];
            attrsNode.nodes.forEach(nd => {
                /^@taglib$/i.test(nd.object.name) && ary.push(nd);                      // 找到
            });

            if ( !ary.length ) return;                                                  // 没有找到相关节点，跳过

            if ( ary.length > 1 ) {
                // 属性 @taglib 不能重复
                throw new Err('duplicate attribute of @taglib', { ...context.input, ...ary[1].object.Name.pos });
            }
            if ( /^(if|for|svgicon|router|router-link)$/.test(object.value) ) {
                throw new Err(`unsupport @taglib on tag <${object.value}>`, { ...context.input, ...ary[0].object.Name.pos });
            }

            // 创建节点保存
            let oNode = ary[0].clone();
            oNode.type = '@taglib';
            oNode.object.type = '@taglib';

            node.addChild(oNode);
            ary[0].remove();    // 删除节点

        });

    });

}());

