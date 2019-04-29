const bus = require('@gotoeasy/bus');

bus.on('全部编译', function (){

    return function(){

        let oFiles = bus.at('源文件对象清单');
        let env = bus.at('编译环境');

        bus.at('项目配置处理', env.path.root + 'rpose.config.btf');

        let promises = [];
        let stime, time;
        for ( let file in oFiles ) {
            try{
                stime = new Date().getTime();

                let context = bus.at('编译组件', oFiles[file]);
                context.result.browserifyJs && promises.push(context.result.browserifyJs);

                time = new Date().getTime() - stime;
                if ( time > 100 ) {
                    console.info('[compile] ' + time + 'ms -', file.replace(env.path.src + '/', ''));
                }
            }catch(e){
                bus.at('组件编译缓存', file , false);     // 出错时确保删除缓存（可能组件编译过程成功，页面编译过程失败）
                throw e;
            }
        }
        return promises;
    }

}());


