const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

console.time('load');
    require('@gotoeasy/npm').requireAll(__dirname, 'src/**.js');
console.timeEnd('load');


async function build(opts){
console.time('build');

        try{
            bus.at('编译环境', opts);
            bus.at('clean');

            await bus.at('全部编译');
        }catch(e){
            console.error(Err.cat('build failed', e).toString());
        }

console.timeEnd('build');
}

function clean(opts){
console.time('clean');

        try{
            bus.at('编译环境', opts);
            bus.at('clean');
        }catch(e){
            console.error(Err.cat('clean failed', e).toString());
        }

console.timeEnd('clean');
}


async function watch(opts){

    await build(opts);
    bus.at('文件监视');

}

module.exports = { build, clean, watch };

