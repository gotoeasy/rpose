const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const resolvepkg = require('resolve-pkg');

bus.on('RPOSE运行时代码', function(src){
    
    return function(){

        if ( !src ) {
            let file = File.resolve( resolvepkg('@rpose/runtime', {cwd: __dirname}), 'runtime.js' );
            src = File.read(file);
        }
        return src;
    };

}());
