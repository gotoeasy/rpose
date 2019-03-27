const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');
const browserSync = require("browser-sync");

bus.on('全部编译', function (bs){

    return function(srcfile){
        let srcfiles = bus.at('源文件清单');

        // 编译
        srcfiles.forEach(file => {
            let context = bus.at('编译组件', file);
        });
        
        createBrowserSync();
    }

    // 监视模式时，创建服务器同步刷新浏览器
    function createBrowserSync(){
        let env = bus.at('编译环境');
        if ( env.watch ) {
            bs = browserSync.create('sync');
            bs.init({
                server: env.path.build_dist
            });
            bs.watch('**/*.html');
        }
    }


    bus.on('同步刷新浏览器', function (){
        console.info('------reload--watch--1--', env.watch)
        let env = bus.at('编译环境');
        env.watch && bs.reload();
        console.info('------reload--watch--2--', env.watch)
    });

}());


