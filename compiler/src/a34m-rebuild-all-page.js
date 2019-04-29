const bus = require('@gotoeasy/bus');

bus.on('重新编译全部页面', function (){

    return async function(){

        let time, time1, stime = new Date().getTime();
        let env = bus.at('编译环境');
        let oFiles = bus.at('源文件对象清单');
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file );
            if ( context && context.result && context.result.isPage ) {
                bus.at('组件编译缓存', file , false);     // 如果是页面则清除该页面的编译缓存
            }
        }

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


