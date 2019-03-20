const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( OPTS.TypeHtmlComment, (node, object) => {
            node.remove();      // 删除注释节点
        });

    });

}());

