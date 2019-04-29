const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');
        let oCache = bus.at('缓存');
        let cacheKey = JSON.stringify(['page-gen-js-browserify-minformat', bus.at('browserslist'), env.release, context.result.babelJs]);
        if ( !env.nocache ) {
            let cacheValue = oCache.get(cacheKey);
            if ( cacheValue ) return context.result.browserifyJs = Promise.resolve(cacheValue);
        }

        context.result.browserifyJs = new Promise((resolve, reject) => {

            csjs.browserify(context.result.babelJs, null).then( js => {
                js = env.release ? csjs.miniJs(js) : csjs.formatJs(js);
                oCache.set(cacheKey, js);
                resolve(js);
            }).catch(e => {
                File.write(env.path.build + '/error/browserify.log', context.result.babelJs + '\n\n' + e.stack);
                bus.at('组件编译缓存', context.input.file, false);                          // 删除当前文件的编译缓存
                reject(e);
            });
        
        });

    });

}());

