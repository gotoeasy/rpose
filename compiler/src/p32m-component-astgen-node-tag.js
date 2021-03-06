const bus = require('@gotoeasy/bus');

bus.on('astgen-node-tag', function(){
    return tagJsify;
}());

// 单个标签节点的代码生成
function tagJsify(node, context){
    if ( node.type !== 'Tag' ) return '';

    let obj = node.object;                                                  // 当前节点数据对象
    let isTop = node.parent.type === 'View';                                // 是否为组件的顶部节点
    let isStatic = isStaticTagNode(node);                                   // 是否为静态不变节点，便于运行期的节点差异比较优化
    let isComponent = !node.object.standard;                                // 是否为组件标签节点
    let oAttrsRs = bus.at('astgen-node-attributes', node, context);         // 属性结果对象
    let attrs = oAttrsRs.result;
    let childrenJs = "";
	if ( !oAttrsRs.hasInner ) {                                             // 不含 innerHTML|innerTEXT|textContent 属性时生成子节点，否则忽略子节点
        childrenJs = bus.at('astgen-node-tag-nodes', node.nodes, context);  // 子节点代码，空白或 [{...},{...},{...}]
	}
    let events = bus.at('astgen-node-events', node, context);
    let isSvg = node.object.svg;                                            // 是否svg标签或svg子标签
    let atkey = bus.at('astgen-node-@key', node, context);                  // @key的值

    // style和class要合并到attrs中去
    let style = bus.at('astgen-node-style', node, context);
    if ( style ) {
        if ( !attrs ) {
            attrs = `{style: ${style}}`;
        }else{
            attrs = attrs.replace(/\}\s*$/, `,style: ${style}}`);
        }
    }
    let clasz = bus.at('astgen-node-class', node, context);
    if ( clasz ) {
        if ( !attrs ) {
            attrs = `{class: ${clasz}}`;
        }else{
            attrs = attrs.replace(/\}\s*$/, `,class: ${clasz}}`);
        }
    }

    // 有单纯的表达式对象属性时，转换成对象复制语句
    let props = bus.at('astgen-node-{prop}', node, context);                // (prop1),(prop2)
    if ( props ) {
        attrs = attrs ? `rpose.assign( ${attrs}, ${props})` : `${props}`;   // 有其他属性时用对象复制形式合并，否则直接赋值
    }


    let ary = [];
    ary.push(                   `{ `                                    );     
    ary.push(                   `  t: '${obj.value}' `                  );  // 标签名
    isTop && ary.push(          ` ,r: 1 `                               );  // 顶部节点标识
    isStatic && ary.push(       ` ,x: 1 `                               );  // 静态节点标识（当前节点和子孙节点没有变量不会变化）
    isComponent && ary.push(    ` ,m: 1 `                               );  // 组件标签节点标识（便于运行期创建标签或组件）
    isSvg && ary.push(          ` ,g: 1 `                               );  // svg标签或svg子标签标识
    !atkey && ary.push(         ` ,k: ${context.keyCounter++} `         );  // 节点标识（便于运行期差异比较优化）
    atkey && ary.push(          ` ,K: ${atkey} `                        );  // 自定义节点标识（便于运行期差异比较优化）
    childrenJs && ary.push(     ` ,c: ${childrenJs} `                   );  // 子节点数组
    attrs && ary.push(          ` ,a: ${attrs} `                        );  // 属性对象
    events && ary.push(         ` ,e: ${events} `                       );  // 事件对象
    ary.push(                   `}`                                     );

    return ary.join('\n');
}

// TODO
function isStaticTagNode(/* node */){
    return false;
}

