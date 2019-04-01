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
		watcher.on('add', async file => {
            if ( ready && (file = file.replace(/\\/g, '/')) && /\.rpose$/i.test(file) ) {
                if ( isValidRposeFile(file) ) {
                    console.info('add ......', file);
                    let text = File.read(file);
                    let hashcode = hash(text);
                    let oFile = {file, text, hashcode};
                    oHash[file] = oFile;
                    await busAt('源文件添加', oFile);
                }else{
                    console.info('ignored ...... add', file);
                }
            }
		}).on('change', async file => {
            if ( ready && (file = file.replace(/\\/g, '/')) && /\.rpose$/i.test(file) ) {
                if ( isValidRposeFile(file) ) {
                    let text = File.read(file);
                    let hashcode = hash(text);
                    if ( !oHash[file] || oHash[file].hashcode !== hashcode ) {
                        console.info('change ......', file);
                        let oFile = {file, text, hashcode};
                        oHash[file] = oFile;
                        await busAt('源文件修改', oFile);
                    }
                }else{
                    console.info('ignored ...... change', file);
                }
            }
		}).on('unlink', async file => {
            if ( ready && (file = file.replace(/\\/g, '/')) && /\.rpose$/i.test(file) ) {
                if ( isValidRposeFile(file) ) {
                    console.info('del ......', file);
                    delete oHash[file];
                    await busAt('源文件删除', file);
                }else{
                    console.info('ignored ...... del', file);
                }
            }
		}).on('ready', () => {
			ready = true;
		});

    }


}());


async function busAt(name, ofile){
    console.time('build');
    let promises = bus.at(name, ofile);
    if ( promises ) {
        for ( let i=0,p; p=promises[i++]; ) {
            try{
                await p;
            }catch(e){
                console.error(Err.cat('build failed', e).toString());
            }
        }
    }
    console.timeEnd('build');
}

function isValidRposeFile(file){
    let name = File.name(file);
    if ( /[^a-zA-Z0-9_\-]/.test(name) || !/^[a-zA-Z]/.test(name) ) {
        return false;
    }
    return true;
}
