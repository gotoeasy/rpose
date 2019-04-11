const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');

bus.on('全部编译', function (bs){

    return function(){

        let oFiles = bus.at('源文件对象清单');
        let env = bus.at('编译环境');

        bus.at('项目配置处理', env.path.root + 'rpose.config.btf');

        let promises = [];
        let stime, time;
        for ( let key in oFiles ) {
            stime = new Date().getTime();

            let context = bus.at('编译组件', oFiles[key]);
            context.result.browserifyJs && promises.push(context.result.browserifyJs);

            time = new Date().getTime() - stime;
            if ( time > 100 ) {
                console.info('[compile] ' + time + 'ms -', key.replace(env.path.src + '/', ''));
            }
        }
        return promises;
    }

}());


