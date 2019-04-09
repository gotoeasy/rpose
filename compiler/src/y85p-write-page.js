const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const hash = require('@gotoeasy/hash');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const fs = require('fs');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');
        let browserslist = bus.at('browserslist');

        let stime = new Date().getTime(), time;
        context.result.browserifyJs.then(browserifyJs => {

            let fileHtml = bus.at('页面目标HTML文件名', context.input.file);
            let fileCss = bus.at('页面目标CSS文件名', context.input.file);
            let fileJs = bus.at('页面目标JS文件名', context.input.file);

            let html = context.result.html;
            let css = context.result.pageCss;
            let js = browserifyJs;
            context.result.js = js;

            css ? File.write( fileCss, css ) : File.remove( fileCss );
            File.write( fileJs, js );
            File.write( fileHtml, html );

            env.watch && (context.result.hashcode = hash(html+css+js));        // 计算页面编译结果的哈希码，供浏览器同步判断使用

            time = new Date().getTime() - stime;
            console.info('[pack]', time + 'ms -', fileHtml.substring(env.path.build_dist.length+1));

        }).catch(e => {
            console.error('[pack]', e);
        });


    });

}());

