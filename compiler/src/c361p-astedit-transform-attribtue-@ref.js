const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 转换处理指令节点 @ref
    return postobject.plugin(__filename, function(root, context){

        root.walk( '@ref', (node, object) => {

            let tagNode = node.parent;                                                  // 所属标签节点

            if ( bus.at('是否表达式', object.value) ) {
                // 属性 @ref 不能使用表达式
                throw new Err('@ref unsupport the expression', {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
            }


            // TODO @ref 转为特殊属性处理，需同步修改运行时脚本
            // 添加到普通属性中使用

            // 查找Attributes
            let attrsNode;
            for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
                if ( nd.type === 'Attributes' ) {
                    attrsNode = nd;
                    break;
                }
            }

            let cNode = node.clone();
            cNode.type = 'Attribute';
            cNode.object.type = 'Attribute';
            cNode.object.name = 'ref';

            let $contextNode = node.clone();
            $contextNode.type = 'Attribute';
            $contextNode.object.type = 'Attribute';
            $contextNode.object.name = '$context';
            $contextNode.object.value = '{$this}';
            $contextNode.object.isExpression = true;

            if ( !attrsNode ) {
                attrsNode = this.createNode({type: 'Attributes'});
                tagNode.addChild(attrsNode);
            }
            attrsNode.addChild(cNode);              // @ref 转为 ref属性
            attrsNode.addChild($contextNode);       // 含ref属性时，自动添加$context属性，避免组件对象上下文混乱，深度slot内的标签含ref属性时特需
            node.remove();                          // 删除节点


        });

    });

}());

