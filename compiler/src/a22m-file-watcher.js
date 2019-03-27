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

		// 监视文件变化
		let ready, watcher = chokidar.watch(env.path.src);
		watcher.on('add', file => {
            try{
                if ( ready && (file = file.replace(/\\/g, '/')) && file.endsWith('.rpose') ) {
                    console.info('add ......', file);
                    let text = File.read(file);
                    let hashcode = hash(text);
                    bus.at('源文件添加', file, text, hashcode);
                    oHash[file] = hashcode;
                }
            }catch(e){
                console.error(Err.cat('build failed', e).toString());
            }
		}).on('change', file => {
            try{
                if ( ready && (file = file.replace(/\\/g, '/')) && file.endsWith('.rpose') ) {
                    let text = File.read(file);
                    let hashcode = hash(text);

                    if ( oHash[file] !== hashcode ) {
                        console.info('change ......', file);
                        oHash[file] = hashcode;
                        bus.at('源文件修改', file, text, hashcode);
                    }
                }
            }catch(e){
                console.error(Err.cat('build failed', e).toString());
            }
		}).on('unlink', file => {
            try{
                if ( ready && (file = file.replace(/\\/g, '/')) && file.endsWith('.rpose') ) {
                    console.info('del ......', file);
                    bus.at('源文件删除', file);
                    delete oHash[file];
                }
            }catch(e){
                console.error(Err.cat('build failed', e).toString());
            }
		}).on('ready', () => {
			ready = true;
		});
        
    }


}());


