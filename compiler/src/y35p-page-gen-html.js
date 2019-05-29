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
        
        let inlinesymbols = hasSvgInlineSymbols(context) ? bus.at('生成SVG内联SYMBOL定义代码', file) : '';

        bus.at('生成各关联包的外部SYMBOL定义文件', context);

        context.result.html = require(env.prerender)({srcPath, file, name, type, nocss, inlinesymbols});
    });

}());

function hasSvgInlineSymbols(context){

    if ( context.result.hasSvgInlineSymbol ) return true;

    let allreferences = context.result.allreferences;
    for ( let i=0,tagpkg,ctx; tagpkg=allreferences[i++]; ) {
        let tagSrcFile = bus.at('标签源文件', tagpkg);
        ctx = bus.at('组件编译缓存', tagSrcFile);
        if ( ctx && ctx.result.hasSvgInlineSymbol ){
            return true;
        }
    }

    return false;
}

