const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const hash = require('@gotoeasy/hash');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面
        let env  = bus.at('编译环境');

        context.result.promiseJs = (async function(){

            let hashbrowsers = bus.at('browserslist');
            let hashcode = hash(context.result.pageJs);
            let action = env.release ? 'min' : 'format';
            let cachefile = `${bus.at('缓存目录')}/babel-browserify-${hashbrowsers}/${hashcode}-${action}.js`;

            if ( !env.nocache && File.existsFile(cachefile) ) return File.read(cachefile);

            let js = context.result.pageJs;
            try{
                js = csjs.babel(js);
                js = await csjs.browserify(js, null);
                env.release ? (js = csjs.miniJs(js)) : (js = csjs.formatJs(js));
            }catch(e){
                File.write(env.path.build + '/error-babel-browserify.log', js + '\n\n' + e.stack);
                throw e;
            }

            File.write(cachefile, js);
            return js;
        })();

    });

}());

