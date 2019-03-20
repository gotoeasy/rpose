const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');

// -------------------------------------------------------------
// 取缓存目录
// -------------------------------------------------------------
module.exports = bus.on('缓存目录', function(cachepath){

    return function(){

        return (process.cwd() + '/.cache/' + bus.at('编译环境').compilerVersion).replace(/\\/g, '/');
    }

}());

