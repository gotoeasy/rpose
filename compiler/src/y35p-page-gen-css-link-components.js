const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let env  = bus.at('编译环境');
        let allreferences = context.result.allreferences;

        let ary = [];
        allreferences.forEach(tagpkg => {
            let ctx = bus.at('组件编译缓存', bus.at('标签源文件', tagpkg));
            if ( !ctx ) {
                ctx = bus.at('编译组件', tagpkg);
            }
            ctx.result.css && ary.push(ctx.result.css);
        });

        context.result.css = ary.join('\n');
        context.result.pageCss = bus.at('页面样式后处理', context.result.css, context.input.file);
    });

}());

