const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
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

        context.result.promiseJs.then(js => {

            if ( env.release ) {
                File.write( fileCss, csso.minify(context.result.css, {forceMediaMerge: true}).css );
//                File.write( fileCss, context.result.css );
            }else{
                File.write( fileCss, context.result.css );
            }

            File.write( fileJs, js );
            File.write( fileHtml, context.result.html );

            bus.at('同步刷新浏览器')

        }).catch(e => {
            console.error('[write-page]', e);
        });

    });

}());

