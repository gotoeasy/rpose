const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');

        browserifyJs(env, context);
    });

}());


function browserifyJs(env, context){

    let stime = new Date().getTime(), time;
    context.result.browserifyJs.then(browserifyJs => {

        let fileHtml = bus.at('页面目标HTML文件名', context.input.file);
        let fileCss = bus.at('页面目标CSS文件名', context.input.file);
        let fileJs = bus.at('页面目标JS文件名', context.input.file);
        let svgSymbolHashcode = '';
        if ( bus.at('页面是否引用外部SVG-SYMBOL文件', context.input.file) ) {
            let oSvgSymbol = bus.at('生成项目SVG-SYMBOL文件');
            svgSymbolHashcode = oSvgSymbol.hashcode;
        }

        let html = context.result.html;
        let css = context.result.pageCss;
        let js = browserifyJs;
        context.result.js = js;

        css ? File.write( fileCss, css ) : File.remove( fileCss );
        File.write( fileJs, js );
        File.write( fileHtml, html );

        env.watch && (context.result.hashcode = hash(html+css+js) + '-' + svgSymbolHashcode);       // 计算页面编译结果的哈希码，供浏览器同步判断使用

        delete context.result.babelJs;
        delete context.result.browserifyJs;

        time = new Date().getTime() - stime;
        console.info('[pack]', time + 'ms -', fileHtml.substring(env.path.build_dist.length+1));

    }).catch(e => {
        console.error('[pack]', e);
    });
}


// 外部SVG-SYMBOL文件内容变化时，重新计算页面哈希码，以便热刷新
bus.on('重新计算页面哈希码', function(){

    return () => {
        let env = bus.at('编译环境');
        if ( !env.watch ) return;

        let oFiles = bus.at('源文件对象清单');
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file);
            if ( bus.at('页面是否引用外部SVG-SYMBOL文件', file) ) {
                let oSvgSymbol = bus.at('生成项目SVG-SYMBOL文件');
                let ary = (context.result.hashcode || '').split('-');
                ary.length > 1 && ary.pop();
                ary.push(oSvgSymbol.hashcode);                                                          // 替换减号后面的哈希码
                context.result.hashcode = ary.join('-');
            }
        }
    };

}());

