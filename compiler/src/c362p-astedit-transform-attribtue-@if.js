const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 转换处理指令节点 @ref
    return postobject.plugin(__filename, function(root, context){

        root.walk( '@if', (node, object) => {

            let tagNode = node.parent;                                                      // 所属标签节点

            let type = 'JsCode';
            let value = 'if (' + object.value.replace(/^\s*\{=?/, '').replace(/\}\s*$/, '') + ') {';
            let jsNode = this.createNode({type, value});
            tagNode.before(jsNode);

            value = '}';
            jsNode = this.createNode({type, value});
            tagNode.after(jsNode);

            node.remove();   // 删除节点

        });


    });

}());

