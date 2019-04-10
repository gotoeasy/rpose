const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');
        let oCache = bus.at('缓存');
        let cacheKey = JSON.stringify(['page-gen-js-babel', bus.at('browserslist'), context.result.pageJs]);
        if ( !env.nocache ) {
            let cacheValue = oCache.get(cacheKey);
            if ( cacheValue ) return context.result.babelJs = cacheValue;
        }

        try{
            context.result.babelJs = csjs.babel(context.result.pageJs);
            oCache.set(cacheKey, context.result.babelJs);
        }catch(e){
            File.write(env.path.build + '/error/babel.log', context.result.pageJs + '\n\n' + e.stack);
            throw e;
        }

    });

}());

