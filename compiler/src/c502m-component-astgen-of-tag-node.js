const bus = require('@gotoeasy/bus');

bus.on('astgen-of-tag-node', function(){
    return tagJsify;
}());

// 单个标签节点的代码生成
function tagJsify(node, context){
    if ( node.type !== 'Tag' ) return '';

    let obj = node.object;                                                  // 当前节点数据对象
    let isTop = node.parent.type === 'View';                                // 是否为组件的顶部节点
    let isStatic = isStaticTagNode(node);                                   // 是否为静态不变节点，便于运行期的节点差异比较优化
    let isComponent = !node.object.standard;                                // 是否为组件标签节点
    let childrenJs = bus.at('astgen-of-nodes', node.nodes, context);        // 子节点代码，空白或 [{...},{...},{...}]
    let attrs = bus.at('astgen-of-attributes-node', node, context);
    let events = bus.at('astgen-of-events-node', node, context);

    let ary = [];
    ary.push(                   `{ `                                    );     
    ary.push(                   `  t: '${obj.value}' `                  );  // 标签名
    isTop && ary.push(          ` ,r: 1 `                               );  // 顶部节点标识
    isStatic && ary.push(       ` ,x: 1 `                               );  // 静态节点标识（当前节点和子孙节点没有变量不会变化）
    isComponent && ary.push(    ` ,m: 1 `                               );  // 组件标签节点标识（便于运行期创建标签或组件）
    ary.push(                   ` ,k: ${context.keyCounter++} `         );  // 组件范围内的唯一节点标识（便于运行期差异比较优化）
    childrenJs && ary.push(     ` ,c: ${childrenJs} `                   );  // 静态节点标识（当前节点和子孙节点没有变量不会变化）
    attrs && ary.push(          ` ,a: ${attrs} `                        );  // 属性对象
    events && ary.push(         ` ,e: ${events} `                       );  // 事件对象
    ary.push(                   `}`                                     );

    return ary.join('\n');
}

// TODO
function isStaticTagNode(node){
    return false;
}

