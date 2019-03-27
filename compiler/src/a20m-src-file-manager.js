const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');

(function (fileSet){

    bus.on('源文件清单', function(){

        if ( !fileSet ) {
            let env = bus.at('编译环境');
            let files = File.files(env.path.src, '**.rpose');                   // 源文件目录
//                let buildinfiles = File.files(env.path.src_buildin, '**.rpose');    // 内置源文件目录
//                files.unshift(...buildinfiles);                                     // 添加到数组起始位置
            fileSet = new Set(files);
            return [...fileSet];
        }

        return [...fileSet];
    });

    bus.on('源文件添加', function(file){
        fileSet.add(file);
        bus.at('编译组件', file);
    });

    bus.on('源文件删除', function(...files){
        files.forEach(file => {
            fileSet.delete(file);
            bus.at('组件编译缓存', file, false);   // 删除该文件编译缓存
        });
    });

    bus.on('源文件修改', function(file){
console.info('[nnnnnnnnnnnnnnnnnnnn]', '......', file);
        bus.at('编译组件', file, File.read(file), true);
        bus.at('同步刷新浏览器');
    });

})();
