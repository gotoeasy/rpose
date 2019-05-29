const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 内置for标签和if标签的转换
    // 前面已处理@for和@if，这里直接提升子节点就行了（节点无关属性全忽略）
    return postobject.plugin(/**/__filename/**/, function(root, context){

        root.walk( 'Tag', (node, object) => {
            if ( !/^(if|for)$/i.test(object.value) ) return;

            if ( !node.ok ){
                throw new Err(`missing attribute @${object.value} of tag <${object.value}>`, { ...context.input, start: object.pos.start })
            }

            node.nodes.forEach( nd => {
                nd.type !== 'Attributes' && node.before(nd.clone());    // 子节点提升（节点无关属性全忽略）
            });
            node.remove();                                              // 删除本节点
        });

    });

}());
