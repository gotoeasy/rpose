const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 转换处理指令节点 @ref
    return postobject.plugin(/**/__filename/**/, function(root){

        const OPTS = bus.at('视图编译选项');

        root.walk( '@if', (node, object) => {

            let tagNode = node.parent;                                                      // 所属标签节点
            /^if$/i.test(tagNode.object.value) && (tagNode.ok = true);

            let type = OPTS.TypeCodeBlock;
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

