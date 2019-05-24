const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

console.time('load');
    require('@gotoeasy/npm').requireAll(__dirname, 'src/**.js');
console.timeEnd('load');


async function build(opts){
    let stime = new Date().getTime();

    try{
        bus.at('编译环境', opts);
        bus.at('clean');

        await bus.at('全部编译');
    }catch(e){
        console.error(Err.cat('build failed', e).toString());
    }

    let time = new Date().getTime() - stime;
    console.info('build ' + time + 'ms');       // 异步原因，统一不使用time/timeEnd计时
}

function clean(opts){
    let stime = new Date().getTime();

    try{
        bus.at('编译环境', opts);
        bus.at('clean');
    }catch(e){
        console.error(Err.cat('clean failed', e).toString());
    }

    let time = new Date().getTime() - stime;
    console.info('clean ' + time + 'ms');       // 异步原因，统一不使用time/timeEnd计时
}


async function watch(opts){

    await build(opts);
    bus.at('文件监视');

}

module.exports = { build, clean, watch };

