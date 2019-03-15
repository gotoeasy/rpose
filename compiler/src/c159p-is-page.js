const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 目录不含‘components’或‘node_modules’，且有[mount]时判断为页面
    return postobject.plugin(__filename, function(root, context){

        context.result.isPage = context.doc.mount && !/\/components\//i.test(context.input.file) && !/\/node_modules\//i.test(context.input.file);

    });

}());
