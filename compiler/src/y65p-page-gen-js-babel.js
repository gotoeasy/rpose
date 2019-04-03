const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const hash = require('@gotoeasy/hash');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');

        let hashbrowsers = bus.at('browserslist');
        let hashcode = hash(context.result.pageJs);
        let cachefile = `${bus.at('缓存目录')}/${hashbrowsers}-babel/${hashcode}-babel.js`;

        if ( !env.nocache && File.existsFile(cachefile) ) {
            return context.result.babelJs = File.read(cachefile);
        }

        try{
            context.result.babelJs = csjs.babel(context.result.pageJs);
            File.write(cachefile, context.result.babelJs);
        }catch(e){
            File.write(env.path.build + '/error/babel.log', context.result.pageJs + '\n\n' + e.stack);
            throw e;
        }

    });

}());

