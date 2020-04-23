const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 把 @merge 转换为普通的onchange写法
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
            if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ) return;    // 节点没有定义属性，跳过

            // 查找目标属性节点
            let ary = [];
            attrsNode.nodes.forEach(nd => {
                /@merge/i.test(nd.object.name) && ary.push(nd);                         // 找到
            });

            if ( !ary.length ) return;                                                  // 没有找到相关节点，跳过

            if ( ary.length > 1 ) {
                // 属性 @merge 不能重复
                throw new Err('duplicate attribute of @merge', { ...context.input, ...ary[1].object.Name.pos });
            }
            if ( /^@?(if|for|svgicon|router|router-link)$/.test(object.value) || (object.standard && !/(input|select|textarea)/i.test(object.value)) ) {
                // 仅支持特定的几个标准标签，以及组件标签
                throw new Err(`unsupport @merge on tag <${object.value}>`, { ...context.input, ...ary[0].object.Name.pos });
            }

            // 开始转换
            context.result.merge = true;                                                // 标记为有@merge，用于后续处理自动判断加入merge方法

            let mergeAttrNode = ary[0];
            if ( object.standard ) {
                // 在标准标签(input/select/textarea)上写@merge

                // 转换 @merge="code" -> onchange={ e => this.merge( {'code': e.targetNode.value} ) }
                let filed = mergeAttrNode.object.value.trim();
                mergeAttrNode.object.name = 'onchange';                                 // @merge -> onchange
                mergeAttrNode.object.value = `{ e => this.merge( {'${filed}': e.targetNode.value} ) }`;
                mergeAttrNode.object.isExpression = true;                               // 转换为箭头函数表达式
                mergeAttrNode.object.isObjectExpression = false;                        // 不是对象表达式
            }else{
                // 在组件标签上写@merge

                // TODO
            }

        });

    });

}());

