const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const hash = require('@gotoeasy/hash');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const csso = require('csso');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');
        let browserslist = bus.at('browserslist');

        let fileHtml = bus.at('页面目标HTML文件名', context.input.file);
        let fileCss = bus.at('页面目标CSS文件名', context.input.file);
        let fileJs = bus.at('页面目标JS文件名', context.input.file);

        context.result.promiseJs.then(async js => {

            let html = context.result.html;
            let css = await context.result.promiseCss;
            context.result.css = css;
            context.result.js = js;

            File.write( fileCss, css );
            File.write( fileJs, js );
            File.write( fileHtml, html );

            env.watch && (context.result.hashcode = hash(html+css+js));        // 计算页面编译结果的哈希码，供浏览器同步判断使用

            console.info('write ..........', fileHtml);

        }).catch(e => {
            console.error('[write-page]', e);
        });

    });

}());

