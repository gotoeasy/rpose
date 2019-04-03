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
        let hashcode = hash(context.result.babelJs);
        let action = env.release ? 'min' : 'format';
        let cachefile = `${bus.at('缓存目录')}/${hashbrowsers}-browserify-${action}/${hashcode}-browserify-${action}.js`;

        if ( !env.nocache && File.existsFile(cachefile) ) {
            return context.result.browserifyJs = Promise.resolve(File.read(cachefile));
        }

        context.result.browserifyJs = new Promise((resolve, reject) => {

            let stime = new Date().getTime();
            csjs.browserify(context.result.babelJs, null).then( js => {
                js = env.release ? csjs.miniJs(js) : csjs.formatJs(js);
                File.write(cachefile, js);
                resolve(js);
            }).catch(e => {
                File.write(env.path.build + '/error/browserify.log', context.result.babelJs + '\n\n' + e.stack);
                reject(e);
            });
        
        });

    });

}());

