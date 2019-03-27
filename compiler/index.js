const bus = require('@gotoeasy/bus');
const npm = require('@gotoeasy/npm');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');

console.time('load')
    npm.requireAll(__dirname, 'src/**.js');
console.timeEnd('load')


function build(opts){
console.time('build');

        try{
			let env = bus.at('编译环境', opts);
			bus.at('clean');

            bus.at('全部编译');
        }catch(e){
			console.error(Err.cat('build failed', e).toString());
		}

console.timeEnd('build');
}

function clean(opts){
console.time('clean');

        try{
			let env = bus.at('编译环境', opts);
			bus.at('clean');
        }catch(e){
			console.error(Err.cat('clean failed', e).toString());
		}

console.timeEnd('clean');
}


function watch(opts){

    build(opts);
    bus.at('文件监视');

}

module.exports = { build, clean, watch };

