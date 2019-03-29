const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');

bus.on('全部编译', function (bs){

    return function(srcfile){

        let oFiles = bus.at('源文件对象清单');
        for ( let key in oFiles ) {
            bus.at('编译组件', oFiles[key]);
        }

    }

}());


