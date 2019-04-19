const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');

bus.on('全部重新编译', function (bs){

    return async function(){

        let time, time1, stime = new Date().getTime();
        let env = bus.at('编译环境');
        bus.at('清除全部编译缓存');                                          // 清除全部编译缓存
        env = bus.at('编译环境', env, true);                                // 重新设定编译环境
        bus.at('项目配置处理', env.path.root + 'rpose.config.btf', true);   // 重新解析项目配置处理
        let oFiles = bus.at('源文件对象清单', true);                        // 源文件清单重新设定

        let promises = [];
        for ( let key in oFiles ) {
            time1 = new Date().getTime();

            let context = bus.at('编译组件', oFiles[key]);
            context.result.browserifyJs && promises.push(context.result.browserifyJs);

            time = new Date().getTime() - time1;
            if ( time > 100 ) {
                console.info('[compile] ' + time + 'ms -', key.replace(env.path.src + '/', ''));
            }

        }

        await Promise.all( promises );

        time = new Date().getTime() - stime;
        console.info('[build] ' + time + 'ms');

    }

}());


