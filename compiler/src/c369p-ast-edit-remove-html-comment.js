const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
	return postobject.plugin(__filename, function(root, context){

        root.walk( 'HtmlComment', (node, object) => {
            node.remove(); // 删除注释节点
        });

    });

}());

