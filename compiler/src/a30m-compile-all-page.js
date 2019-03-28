const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');

bus.on('全部编译', function (bs){

    return function(srcfile){
        let srcfiles = bus.at('源文件清单');

        // 编译
        srcfiles.forEach(file => {
            let context = bus.at('编译组件', file);
        });
        
    }

}());


