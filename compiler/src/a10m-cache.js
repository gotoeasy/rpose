const bus = require('@gotoeasy/bus');
const cache = require('@gotoeasy/cache');

(function(result={}, oCache){
    
    bus.on('组件编译缓存', function(file, context){

        if ( context ) {
            result[file] = context;
            return context;
        }

        if ( context === undefined ) {
            return result[file];
        }

        delete result[file];
    });

    bus.on('缓存', function(){

        if ( !oCache ) {
            let env = bus.at('编译环境');
            oCache = cache({name: 'rpose-compiler-' + env.compilerVersion, path: env.path.cache});
        }
        return oCache;

    });

}());
