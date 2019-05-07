const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

// display的合法值（none除外）
const DISPLAY_REG = /(-webkit-box|-webkit-inline-box|block|contents|flex|flow-root|grid|initial|inline|inline-block|inline-flex|inline-grid|list-item|run-in|compact|marker|table|inline-table|table-row-group|table-header-group|table-footer-group|table-row|table-column-group|table-column|table-cell|table-caption|inherit|unset)/i;

bus.on('编译插件', function(){
    
    // 处理标签中指定类型的属性，提取后新建节点管理
    // 处理标签中的 @show 属性
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
                /^@(show|show\.[a-z-]+)$/i.test(nd.object.name) && ary.push(nd);        // 找到
            });

            if ( !ary.length ) return;                                                  // 没有找到相关节点，跳过

            if ( ary.legnth > 1 ) {
                // 属性 @show 不能重复
                throw new Err('duplicate attribute of @show', {file: context.input.file, text: context.input.text, start: ary[1].object.loc.start.pos, end: ary[1].object.loc.end.pos});
            }
            if ( /^(if|for)$/.test(object.value) ) {
                throw new Err(`unsupport attribute @show on tag <${object.value}>`, {file: context.input.file, text: context.input.text, start: ary[0].object.loc.start.pos, end: ary[0].object.loc.end.pos});
            }

            // 创建节点保存
            let oNode = ary[0].clone();
            oNode.type = '@show';
            oNode.object.type = '@show';

            let tmps = oNode.object.name.split('.');
            let display = tmps.length > 1 ? tmps[1] : 'block';                          // @show / @show.flex
            if ( !DISPLAY_REG.test(display) ) {
                throw new Err('invalid display type of @show: ' + display, {file: context.input.file, text: context.input.text, start: ary[0].object.loc.start.pos, end: ary[0].object.loc.end.pos});
            }

            oNode.object.display = display;

            node.addChild(oNode);
            ary[0].remove();    // 删除节点

        });

    });

}());

