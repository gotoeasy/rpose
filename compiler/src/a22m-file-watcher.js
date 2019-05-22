const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');
const hash = require('@gotoeasy/hash');
const chokidar = require('chokidar');

bus.on('文件监视', function (oSrcHash={}, oOthHash={}, hashBrowserslistrc, hashRposeconfigbtf){

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
                    hashBrowserslistrc = hash(File.read(browserslistrc));
                    console.info('add ......', file);
                    bus.at('browserslist', true) > await bus.at('重新编译全部页面');   // 重新查询目标浏览器，然后重新编译全部页面

                }else if ( file === rposeconfigbtf ) {
                    // 配置文件 rpose.config.btf 添加
                    hashRposeconfigbtf = hash(File.read(rposeconfigbtf));
                    console.info('add ......', file);
                    await bus.at('全部重新编译');

                }else if ( file.startsWith(bus.at('编译环境').path.src + '/') && /\.rpose$/i.test(file) ) {
                    // 源文件添加
                    if ( isValidRposeFile(file) ) {
                        console.info('add ......', file);
                        let text = File.read(file);
                        let hashcode = hash(text);
                        let oFile = {file, text, hashcode};
                        oSrcHash[file] = oFile;
                        await busAt('源文件添加', oFile);
                    }else{
                        console.info('ignored ...... add', file);
                    }
                }else if ( isValidSvgiconFile(file) ) {
                    // svg文件添加
                    console.info('add svg ......', file);
                    let text = File.read(file);
                    let hashcode = hash(text);
                    oOthHash[file] = hashcode;
                    await busAt('SVG文件添加', file);
                }else if ( isValidImageFile(file) ) {
                    // 图片文件添加
                    console.info('add img ......', file);
                    let hashcode = hash({file});
                    oOthHash[file] = hashcode;
                    await busAt('图片文件添加');                                     // 只是把没编译成功的都再编译一遍，不需要传文件名
                }else if ( isValidCssFile(file) ) {
                    // CSS文件添加（可能影响本地样式库）
                    console.info('add css ......', file);
                    let hashcode = hash({file});
                    oOthHash[file] = hashcode;
                    await busAt('CSS文件添加', file);
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
                        if ( !oSrcHash[file] || oSrcHash[file].hashcode !== hashcode ) {
                            console.info('change ......', file);
                            let oFile = {file, text, hashcode};
                            oSrcHash[file] = oFile;
                            await busAt('源文件修改', oFile);
                        }
                    }else{
                        console.info('ignored ...... change', file);
                    }
                }else if ( isValidSvgiconFile(file) ) {
                    // svg文件修改
                    let text = File.read(file);
                    let hashcode = hash(text);
                    if ( oOthHash[file] !== hashcode ) {
                        console.info('change svg ......', file);
                        oOthHash[file] = hashcode;
                        await busAt('SVG文件修改', file);
                    }
                }else if ( isValidImageFile(file) ) {
                    // 图片文件修改
                    let hashcode = hash({file});
                    if ( oOthHash[file] !== hashcode ) {
                        console.info('change img ......', file);
                        oOthHash[file] = hashcode;
                        await busAt('图片文件修改', file);
                    }
                }else if ( isValidCssFile(file) ) {
                    // CSS文件修改（可能影响本地样式库）
                    let hashcode = hash({file});
                    if ( oOthHash[file] !== hashcode ) {
                        console.info('change css ......', file);
                        oOthHash[file] = hashcode;
                        await busAt('CSS文件修改', file);
                    }
                }

            }

        }).on('unlink', async file => {
            if ( ready ) {
                file = file.replace(/\\/g, '/');

                if ( file === browserslistrc ) {
                    // 配置文件 .browserslistrc 删除
                    hashBrowserslistrc = null;
                    console.info('del ......', file);
                    bus.at('browserslist', true) > await bus.at('重新编译全部页面');   // 重新查询目标浏览器，然后重新编译全部页面

                }else if ( file === rposeconfigbtf ) {
                    // 配置文件 rpose.config.btf 删除
                    hashRposeconfigbtf = null;
                    console.info('del ......', file);
                    await bus.at('全部重新编译');

                }else if ( file.startsWith(bus.at('编译环境').path.src + '/') && /\.rpose$/i.test(file) ) {
                    // 源文件删除
                    if ( /\.rpose$/i.test(file) ) {
                        if ( isValidRposeFile(file) ) {
                            console.info('del ......', file);
                            delete oSrcHash[file];
                            await busAt('源文件删除', file);
                        }else{
                            console.info('ignored ...... del', file);
                        }
                    }
                }else if ( isValidSvgiconFile(file) ) {
                    // svg文件删除
                    console.info('del svg ......', file);
                    delete oOthHash[file];
                    await busAt('SVG文件删除', file);
                }else if ( isValidImageFile(file) ) {
                    // 图片文件删除
                    console.info('del img ......', file);
                    delete oOthHash[file];
                    await busAt('图片文件删除', file);
                }else if ( isValidCssFile(file) ) {
                    // CSS文件删除
                    console.info('del css ......', file);
                    delete oOthHash[file];
                    await busAt('CSS文件删除', file);
                }

            }

        }).on('ready', () => {
            ready = true;
        });

    }


}());


async function busAt(name, ofile){
    console.time('build');
    let promises = await bus.at(name, ofile);
    if ( promises ) {
        // 此逻辑多数已无用，暂且放着
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
    if ( /[^a-zA-Z0-9_-]/.test(name) || !/^[a-zA-Z]/.test(name) ) {
        return false;
    }
    return true;
}

function isValidSvgiconFile(file){
    let env = bus.at('编译环境');
    let buildPath = env.path.build + '/';
    let node_modulesPath = env.path.root + '/node_modules/';
    let dotPath = env.path.root + '/.';

    return /\.svg$/i.test(file) 
        && !file.startsWith(buildPath)
        && !file.startsWith(node_modulesPath)
        && !file.startsWith(dotPath);
}

function isValidImageFile(file){
    let env = bus.at('编译环境');
    let buildPath = env.path.build + '/';
    let node_modulesPath = env.path.root + '/node_modules/';
    let dotPath = env.path.root + '/.';

    return /\.(jpg|png|gif|bmp|jpeg)$/i.test(file) 
        && !file.startsWith(buildPath)
        && !file.startsWith(node_modulesPath)
        && !file.startsWith(dotPath);
}

function isValidCssFile(file){
    let env = bus.at('编译环境');
    let buildPath = env.path.build + '/';
    let node_modulesPath = env.path.root + '/node_modules/';
    let dotPath = env.path.root + '/.';

    return /\.css$/i.test(file) 
        && !file.startsWith(buildPath)
        && !file.startsWith(node_modulesPath)
        && !file.startsWith(dotPath);
}
