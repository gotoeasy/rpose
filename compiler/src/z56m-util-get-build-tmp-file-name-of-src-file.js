const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');

bus.on('组件目标文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        if ( srcFile.startsWith(env.path.src_buildin) ) {
            return '$buildin/' + File.name(srcFile);  // buildin
        }

        let tagpkg = bus.at('标签全名', srcFile);   // @aaa/bbb:ui-btn
        return tagpkg.replace(':', '/');
    };

}());
