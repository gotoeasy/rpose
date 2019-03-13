const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理标签中指定类型的属性，提取后新建节点管理
    // 处理标签中的 @if 属性
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
            if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return;    // 没有相关属性节点，跳过

            // 查找目标属性节点
            let ary = [];
            attrsNode.nodes.forEach(nd => {
                /^@if$/i.test(nd.object.name) && ary.push(nd);                          // 找到
            });

            if ( !ary.length ) return;                                                  // 没有找到相关节点，跳过

            if ( ary.legnth > 1 ) {
                // 属性 @if 不能重复
                throw new Err('duplicate attribute of @if', {file: context.input.file, text: context.input.text, start: ary[1].object.loc.start.pos, end: ary[1].object.loc.end.pos});
            }

            // 创建节点保存
            let oNode = ary[0].clone();
            oNode.type = '@if';
            oNode.object.type = '@if';

            node.addChild(oNode);
            ary[0].remove();    // 删除节点

        });

    });

}());

