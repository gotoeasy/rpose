const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( OPTS.TypeText, (node, object) => {

            // 保留pre标签中的空白节点
            if ( !/^\s*$/.test(object.value) || node.parent.object.name === 'pre' ) return;

            // 删除边界位置的空白节点
            let nBefore = node.before();
            let nAfter = node.after();
            if ( !nBefore || !nAfter
                || (nBefore.type === 'Tag' || nAfter.type === 'Tag')
                || (nBefore.type === OPTS.TypeHtmlComment || nAfter.type === OPTS.TypeHtmlComment)
                || (nBefore.type === OPTS.TypeCodeBlock || nAfter.type === OPTS.TypeCodeBlock)
            ) {
                node.remove();
            }
        });

    });

}());

