const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');

        let srcPath = env.path.src;
        let file = context.input.file;
        let name = File.name(file);
        let type = context.doc.api.prerender;
        let nocss = !context.result.pageCss
        
        let inlinesymbols = bus.at('生成内联SVG-SYMBOL代码', context.input.file);

        context.result.html = require(env.prerender)({srcPath, file, name, type, nocss, inlinesymbols});
    });

}());
