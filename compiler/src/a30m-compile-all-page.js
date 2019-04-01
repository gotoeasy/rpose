const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');

bus.on('全部编译', function (bs){

    return function(srcfile){

        let oFiles = bus.at('源文件对象清单');
        let env = bus.at('编译环境');
        let pagePromises = [];
        let stime, time;
        for ( let key in oFiles ) {
            stime = new Date().getTime();

            let context = bus.at('编译组件', oFiles[key]);
            context.result.promiseJs && pagePromises.push(context.result.promiseJs);

            time = new Date().getTime() - stime;
            if ( time > 100 ) {
                console.info('[compile] ' + time + 'ms -', key.replace(env.path.src + '/', ''));
            }
        }
        return pagePromises;
    }

}());


