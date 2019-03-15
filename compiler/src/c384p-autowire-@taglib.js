const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 @taglib
    // 检查安装
    return postobject.plugin(__filename, function(root, context){

        root.walk( '@taglib', (node, object) => {

        });

    });

}());

