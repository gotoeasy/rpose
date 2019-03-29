const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');
const hash = require('@gotoeasy/hash');
const chokidar = require('chokidar');

bus.on('文件监视', function (oHash={}){

    return function(){

        let env = bus.at('编译环境');
        if ( !env.watch ) {
            return;
        }

        bus.at('热刷新服务器');

		// 监视文件变化
		let ready, watcher = chokidar.watch(env.path.src);
		watcher.on('add', file => {
            try{
                if ( ready && (file = file.replace(/\\/g, '/')) && file.endsWith('.rpose') ) {
                    console.info('add ......', file);
                    let text = File.read(file);
                    let hashcode = hash(text);
                    let oFile = {file, text, hashcode};
                    oHash[file] = oFile;
                    busAt('源文件添加', oFile);
                }
            }catch(e){
                console.error(Err.cat('build failed', e).toString());
            }
		}).on('change', file => {
            try{
                if ( ready && (file = file.replace(/\\/g, '/')) && file.endsWith('.rpose') ) {
                    let text = File.read(file);
                    let hashcode = hash(text);
                    if ( !oHash[file] || oHash[file].hashcode !== hashcode ) {
                        console.info('change ......', file);
                        let oFile = {file, text, hashcode};
                        oHash[file] = oFile;
                        busAt('源文件修改', oFile);
                    }
                }
            }catch(e){
                console.error(Err.cat('build failed', e).toString());
            }
		}).on('unlink', file => {
            if ( ready && (file = file.replace(/\\/g, '/')) && file.endsWith('.rpose') ) {
                console.info('del ......', file);
                delete oHash[file];
                busAt('源文件删除', file);
            }
		}).on('ready', () => {
			ready = true;
		});
        
    }


}());


function busAt(name, ofile){
    console.time('build');
    try{
        bus.at(name, ofile);
    }catch(e){
        console.error(Err.cat('build failed', e).toString());
    }finally{
        console.timeEnd('build');
    }
}
