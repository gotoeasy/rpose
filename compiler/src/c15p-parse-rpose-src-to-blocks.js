const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let result = context.result;

        root.walk( (node, object) => {

            result.tagpkg = bus.at('标签全名', object.file);

            // 解析源码块
            let blocks = bus.at('RPOSE源文件解析', object.text);

            // 转换为树节点并替换
            let newNode = this.createNode(blocks);
            node.replaceWith(...newNode.nodes);     // 一个Block一个节点

            return false;
        });

    });

}());


