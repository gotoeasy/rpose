const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root){

        const OPTS = bus.at('视图编译选项');

        root.walk( OPTS.TypeHtmlComment, (node) => {
            node.remove();      // 删除注释节点
        });

    });

}());

