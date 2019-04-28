const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');
const hash = require('@gotoeasy/hash');
const chokidar = require('chokidar');

bus.on('文件监视', function (oHash={}, oSvgHash={}, hashBrowserslistrc, hashRposeconfigbtf){

    return function(){

        let env = bus.at('编译环境');
        if ( !env.watch ) {
            return;
        }

        bus.at('热刷新服务器');

		// 监视文件变化
        let browserslistrc = env.path.root + '/.browserslistrc';
        let rposeconfigbtf = env.path.root + '/rpose.config.btf';
		let ready, watcher = chokidar.watch(env.path.root, {ignored: [env.path.build+'/', env.path.root+'/node_modules/']});
		watcher.on('add', async file => {
            if ( ready ) {
                file = file.replace(/\\/g, '/');

                if ( file === browserslistrc ) {
                    // 配置文件 .browserslistrc 添加
                    let hashBrowserslistrc = hash(File.read(browserslistrc));
                    console.info('add ......', file);
                    bus.at('browserslist', true) > await bus.at('重新编译全部页面');   // 重新查询目标浏览器，然后重新编译全部页面

                }else if ( file === rposeconfigbtf ) {
                    // 配置文件 rpose.config.btf 添加
                    let hashRposeconfigbtf = hash(File.read(rposeconfigbtf));
                    console.info('add ......', file);
                    await bus.at('全部重新编译');

                }else if ( file.startsWith(bus.at('编译环境').path.src + '/') && /\.rpose$/i.test(file) ) {
                    // 源文件添加
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
                }else if ( /\.svg$/i.test(file) ) {
                    // svg文件添加
                    console.info('add svg ......', file);
                    let text = File.read(file);
                    let hashcode = hash(text);
                    oSvgHash[file] = hashcode;
                    await busAt('SVG文件添加', file);
                }

            }

        }).on('change', async file => {
            if ( ready ) {
                file = file.replace(/\\/g, '/');

                if ( file === browserslistrc ) {
                    // 配置文件 .browserslistrc 修改
                    let hashcode = hash(File.read(browserslistrc));
                    if ( hashBrowserslistrc !== hashcode ) {
                        hashBrowserslistrc = hashcode;
                        console.info('change ......', file);
                        bus.at('browserslist', true) > await bus.at('重新编译全部页面');   // 重新查询目标浏览器，然后重新编译全部页面
                    }

                }else if ( file === rposeconfigbtf ) {
                    // 配置文件 rpose.config.btf 修改
                    let hashcode = hash(File.read(rposeconfigbtf));
                    if ( hashRposeconfigbtf !== hashcode ) {
                        hashRposeconfigbtf = hashcode;
                        console.info('change ......', file);
                        await bus.at('全部重新编译');
                    }

                }else if ( file.startsWith(bus.at('编译环境').path.src + '/') && /\.rpose$/i.test(file) ) {
                    // 源文件修改
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
                }else if ( /\.svg$/i.test(file) ) {
                    // svg文件修改
                    let text = File.read(file);
                    let hashcode = hash(text);
                    if ( oSvgHash[file] !== hashcode ) {
                        console.info('change svg ......', file);
                        oSvgHash[file] = hashcode;
                        await busAt('SVG文件修改', file);
                    }
                }

            }

		}).on('unlink', async file => {
            if ( ready ) {
                file = file.replace(/\\/g, '/');

                if ( file === browserslistrc ) {
                    // 配置文件 .browserslistrc 删除
                    let hashBrowserslistrc = null;
                    console.info('del ......', file);
                    bus.at('browserslist', true) > await bus.at('重新编译全部页面');   // 重新查询目标浏览器，然后重新编译全部页面

                }else if ( file === rposeconfigbtf ) {
                    // 配置文件 rpose.config.btf 删除
                    let hashRposeconfigbtf = null;
                    console.info('del ......', file);
                    await bus.at('全部重新编译');

                }else if ( file.startsWith(bus.at('编译环境').path.src + '/') && /\.rpose$/i.test(file) ) {
                    // 源文件删除
                    if ( /\.rpose$/i.test(file) ) {
                        if ( isValidRposeFile(file) ) {
                            console.info('del ......', file);
                            delete oHash[file];
                            await busAt('源文件删除', file);
                        }else{
                            console.info('ignored ...... del', file);
                        }
                    }
                }else if ( /\.svg$/i.test(file) ) {
                    // svg文件删除
                    console.info('del svg ......', file);
                    delete oSvgHash[file];
                    await busAt('SVG文件删除', file);
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
