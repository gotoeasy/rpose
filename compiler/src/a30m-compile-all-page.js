const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('全部编译', function (){

    return async function(){

        let oFiles = bus.at('源文件对象清单');
        let env = bus.at('编译环境');

        bus.at('项目配置处理', env.path.root + 'rpose.config.btf');

        let errSet = new Set();
        let stime, time;
        for ( let file in oFiles ) {
            try{
                stime = new Date().getTime();

                let context = bus.at('编译组件', oFiles[file]);

                time = new Date().getTime() - stime;
                if ( time > 100 ) {
                    console.info('[compile] ' + time + 'ms -', file.replace(env.path.src + '/', ''));
                }

                await context.result.browserifyJs;
            }catch(e){
                bus.at('组件编译缓存', file , false);     // 出错时确保删除缓存（可能组件编译过程成功，页面编译过程失败）
                errSet.add(Err.cat(e).toString());
            }
        }

        // 输出汇总的错误信息
        errSet.size && console.error([...errSet].join('\n\n'));
    }

}());


