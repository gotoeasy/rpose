const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const hash = require('@gotoeasy/hash');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // --------------------------------------
    // 处理标签中的 @class 属性
    // 
    // 找出@class
    // 创建类名（atclass-hashxxxx）插入到class属性
    // 创建atclass样式
    // --------------------------------------
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let style = context.style;
        let atclasscss = style.atclasscss = style.atclasscss || [];

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

            // --------------------------------------
            // 找出@class
            // --------------------------------------
            let ary = [];
            attrsNode.nodes.forEach(nd => {
                /^@class$/i.test(nd.object.name) && ary.push(nd);                       // 找到 【@class】属性
            });

            if ( !ary.length ) return;                                                  // 没有找到相关节点，跳过

            if ( ary.legnth > 1 ) {
                // 属性 @class 不能重复
                throw new Err('duplicate attribute of @class', {file: context.input.file, text: context.input.text, start: ary[1].object.loc.start.pos, end: ary[1].object.loc.end.pos});
            }

            let atclassNode = ary[0];                                                   // @class节点
            let atclassValue = atclassNode.object.value;                                // @class="font-size-16px" => font-size-16px
            let atclassName = 'atclass-' + hash(atclassValue);                          // 样式类名 @class="font-size-16px" => atclass-xxxxx

            // --------------------------------------
            // 类名（atclass-hashxxxx）插入到class属性
            // --------------------------------------
            ary = [];
            attrsNode.nodes.forEach(nd => {
                /^class$/i.test(nd.object.name) && ary.push(nd);                        // 找到 【class】属性
            });

            if ( !ary.length ){
                let oNode = atclassNode.clone();                                        // 没有找到class节点，插入一个class节点（简化的克隆@class节点，修改类型和值）
                oNode.type = 'class';
                oNode.object.type = 'class';
                oNode.object.name = 'class';
                oNode.object.value = atclassName;
                attrsNode.addChild(oNode);                                              // 添加到属性节点下
            }else{
                ary[0].object.value += ' ' + atclass;
            }

            // --------------------------------------
            // 创建atclass样式
            // --------------------------------------
            atclasscss.push( bus.at('创建@class样式', atclassName, atclassValue, context.input.file) );

            atclassNode.remove();                                                       // 删除@class节点
        });

    });

}());
