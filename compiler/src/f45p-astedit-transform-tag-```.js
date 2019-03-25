const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 给```节点添加@taglib指令
    return postobject.plugin(__filename, function(root, context){

        root.walk( 'Tag', (node, object) => {
            if ( object.value !== '```' ) return;

            // 查找Attributes，没找到则创建
            let attrsNode;
            for ( let i=0,nd; nd=node.nodes[i++]; ) {
                if ( nd.type === 'Attributes' ) {
                    attrsNode = nd;                                                                         // 因为固定有代码属性$CODE，一定能找到Attributes
                    break;
                }
            }

            // 查找代码属性$CODE
            let codeNode, lang;
            for ( let i=0,nd; nd=attrsNode.nodes[i++]; ) {
                if ( nd.object.name === '$CODE' ) {
                    codeNode = nd;
                    nd.object.value = nd.object.value.replace(/\\\{/g, '{').replace(/\\\}/g, '}');          // 表达式转义还原
                }else if ( nd.object.name === 'lang' ) {
                    lang = nd.object.value;
                }
            }
            codeNode.object.value = bus.at('highlight', codeNode.object.value, lang);                       // 代码转换为语法高亮的html

            // 添加@taglib属性
            let taglibNode = this.createNode({type: 'Attribute'});
            taglibNode.object.name = '@taglib';
            taglibNode.object.value = '@rpose/buildin:```';
            attrsNode.addChild(taglibNode);

        });

    });

}());

