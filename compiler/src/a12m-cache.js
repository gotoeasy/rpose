const bus = require('@gotoeasy/bus');

(function(cache={}){
    
    bus.on('组件编译缓存', function(file, context){

        if ( context ) {
            cache[file] = context;
            return context;
        }

        if ( context === undefined ) {
            return cache[file];
        }

        delete cache[file];
    });

}());
