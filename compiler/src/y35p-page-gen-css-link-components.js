const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let env  = bus.at('编译环境');
        let allreferences = context.result.allreferences;

        let ary = [];
        allreferences.forEach(tagpkg => {
            let ctx = bus.at('编译组件', tagpkg);
            ctx.result.css && ary.push(ctx.result.css);
        });

        context.result.css = ary.join('\n');

    });

}());

