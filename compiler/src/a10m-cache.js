const bus = require('@gotoeasy/bus');
const cache = require('@gotoeasy/cache');
const csslibify = require('csslibify');

(function(result={}, oCache, resourcesPaths){

    bus.on('清除全部编译缓存', function(){
        result = {};
        oCache = null;
        resourcesPaths = null;
    });

    
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

    bus.on('缓存资源目录数组', function(){
        if ( !resourcesPaths ) {
            resourcesPaths = [bus.at('缓存').path + '/resources', csslibify().basePath];    // 编译器缓存及样式库缓存的resources目录的绝对路径
        }
        return resourcesPaths;
    });

}());
