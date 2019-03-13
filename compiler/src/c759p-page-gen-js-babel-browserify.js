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
            let cachefile = `${bus.at('缓存目录')}/babel-browserify/${hashbrowsers}-${hashcode}-${action}.js`;

            if ( !env.nocache && File.existsFile(cachefile) ) return File.read(cachefile);
            
            
            let js;
            try{
                js = csjs.babel(context.result.pageJs);
            }catch(e){
                File.write(env.path.build + '/log/log.txt', context.result.pageJs + '\n\n' + e.stack);
                throw e;
            }

            js = await csjs.browserify(js, null);
            env.release ? (js = csjs.miniJs(js)) : (js = csjs.formatJs(js));

            File.write(cachefile, js);
            return js;
        })();

    });

}());

