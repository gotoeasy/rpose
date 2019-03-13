const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        root.walk( 'Text', (node, object) => {

            // 保留pre标签中的空白节点
            if ( !/^\s*$/.test(object.value) || node.parent.object.name === 'pre' ) return;

            // 删除边界位置的空白节点
            let nBefore = node.before();
            let nAfter = node.after();
            if ( !nBefore || !nAfter
                || (nBefore.type === 'Tag' || nAfter.type === 'Tag')
                || (nBefore.type === 'ComponentTag' || nAfter.type === 'ComponentTag')
                || (nBefore.type === 'HtmlComment' || nAfter.type === 'HtmlComment')
                || (nBefore.type === 'JsCode' || nAfter.type === 'JsCode')
            ) {
                node.remove();
            }
        });

    });

}());

