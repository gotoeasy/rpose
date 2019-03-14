const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 转换处理指令节点 @show
    // 转换为 style中的 display 属性
    return postobject.plugin(__filename, function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( '@show', (node, object) => {

            let tagNode = node.parent;                                                      // 所属标签节点

            // 查找样式属性节点
            let styleNode;
            for ( let i=0,nd; nd=tagNode.nodes[i++]; ) {
                if ( nd.type === 'Style' ) {
                    styleNode = nd;
                    break;  // 找到
                }
            }

            let display = OPTS.ExpressionStart + '(' + object.value.replace(/^\{/, '').replace(/\}$/, '') + ') ? "display:block;" : "display:none;"' + OPTS.ExpressionEnd;
            if ( !styleNode ) {
                // 不存在样式节点时，创建
                styleNode = this.createNode( {type: 'Style', value: display} );
                tagNode.addChild(styleNode);
            }else{
                // 存在样式节点时，修改
                if ( styleNode.object.value.endsWith(';') ) {
                    styleNode.object.value += display;
                }else{
                    styleNode.object.value += ';' + display;        // 放在后面确保覆盖display
                }
            }
            styleNode.object.isExpression = true;

        });


    });

}());

