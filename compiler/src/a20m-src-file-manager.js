const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');
const File = require('@gotoeasy/file');

(function (oFiles, oTagFiles={}){


    function getSrcFileObject(file, tag){
        let text = File.read(file);
        let hashcode = hash(text);
        return {file, text, hashcode, tag};
    }

    // 项目范围内，取标签相关的页面源文件
    function getRefPages(tag){
        if ( !tag ) return [];

        let refFiles = [];
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file);
            if ( context ) {
                let allreferences = context.result.allreferences || [];
                allreferences.includes(tag) && refFiles.push(file);
            }
        }
        
        return refFiles;
    }


    bus.on('标签项目源文件', function(tag){
        let ary = oTagFiles[tag];
        if ( ary && ary.length) {
            return ary[0];
        }
        // 找不到时无视错误，返回undefined
    });

    bus.on('源文件对象清单', function(nocache=false){
        if ( nocache ) {
            oFiles = null;
            oTagFiles = {};
        }

        if ( !oFiles ) {
            oFiles = {};
            let env = bus.at('编译环境');
            let files = File.files(env.path.src, '**.rpose');                                               // 源文件目录
            files.forEach(file => {
                let tag = getTagOfSrcFile(file);
                if ( tag ) {
                    let ary = oTagFiles[tag] = oTagFiles[tag] || [];
                    ary.push(file);
                    if ( ary.length === 1 ) {
                        oFiles[file] = getSrcFileObject(file, tag);
                    }
                }else{
                    console.error('[src-file-manager]', 'ignore invalid source file ..........', file);     // 无效文件出警告
                }
            });

            for ( let tag in oTagFiles ) {
                let ary = oTagFiles[tag];
                if ( ary.length > 1 ) {
                    console.error('[src-file-manager]', 'duplicate tag name:', tag);                        // 同名文件出警告
                    console.error(ary);
                    for ( let i=1,file; file=ary[i++]; ) {
                        console.error('  ignore ..........', file);
                    }
                }
            }

        }

        return oFiles;
    });

    bus.on('源文件添加', async function(oFile){

        let tag = getTagOfSrcFile(oFile.file);
        if ( !tag ) {
            return console.error('[src-file-manager]', 'invalid source file name ..........', oFile.file);  // 无效文件出警告
        }

        let ary = oTagFiles[tag] = oTagFiles[tag] || [];
        ary.push(oFile.file);
        if ( ary.length > 1 ) {
            console.error('[src-file-manager]', 'duplicate tag name:', tag);
            console.error(ary);
            console.error('  ignore ..........', oFile.file);
            return;
        }

        oFiles[oFile.file] = getSrcFileObject(oFile.file, tag);             // 第一个有效
        await bus.at('全部编译');

    });

    bus.on('SVG文件添加', async function(svgfile){
        await bus.at('重新编译和该SVG可能相关的组件和页面', svgfile);
    });

    bus.on('图片文件添加', async function(){

        // 图片文件添加时，重新编译未编译成功的组件
        let oFiles = bus.at('源文件对象清单');
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file);
            if ( !context ) {
                return await bus.at('全部编译');
            }
        }
    });

    bus.on('源文件修改', async function(oFileIn){

        let tag = getTagOfSrcFile(oFileIn.file);
        let refFiles = getRefPages(tag);                                    // 关联页面文件
        let oFile = oFiles[oFileIn.file];
        if ( !tag || !oFile ) {
            // 无关文件的修改，保险起见清理下
            delete oFiles[oFileIn.file];
            return;
        }
        if ( oFile.hashcode === oFileIn.hashcode ) return;                  // 文件内容没变，忽略

        // 保存输入，删除关联编译缓存，重新编译
        oFiles[oFile.file] = Object.assign({}, oFileIn);
        refFiles.forEach(file => {
            bus.at('组件编译缓存', file, false);                             // 删除关联页面的编译缓存
            removeHtmlCssJsFile(file);
        });
        bus.at('组件编译缓存', oFile.file, false);                          // 删除当前文件的编译缓存
        removeHtmlCssJsFile(oFile.file);
        await bus.at('全部编译');
    });

    bus.on('SVG文件修改', async function(svgfile){
        await bus.at('重新编译和该SVG可能相关的组件和页面', svgfile);
    });

    bus.on('图片文件修改', async function(imgfile){

        // 图片文件修改时，找出使用该图片文件的组件，以及使用该组件的页面，都清除缓存后重新编译
        let oFiles = bus.at('源文件对象清单');
        let refFiles = [];
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file);
            if ( context ) {
                let refimages = context.result.refimages || [];
                if ( refimages.includes(imgfile) ) {                        // 比较的是全路径文件名
                    let tag = getTagOfSrcFile(file);                        // 直接关联的组件标签名
                    refFiles.push(file);                                    // 待重新编译的组件
                    refFiles.push(...getRefPages(tag));                     // 待重新编译的页面
                }
            }
        }

        if ( refFiles.length ) {
            (new Set(refFiles)).forEach(pageFile => {
                bus.at('组件编译缓存', pageFile, false);                     // 清除编译缓存
                removeHtmlCssJsFile(pageFile);
            })
            await bus.at('全部编译');
        }

    });


    bus.on('源文件删除', async function(file){

        let tag = getTagOfSrcFile(file);
        let refFiles = getRefPages(tag);                                    // 关联页面文件
        let oFile = oFiles[file];
        let ary = oTagFiles[tag];

        // 删除输入
        delete oFiles[file];
        if ( ary ) {
            let idx = ary.indexOf(file);
            if ( idx > 0 ) {
                return ary.splice(idx, 1);                                  // 删除的是被忽视的文件
            }else if ( idx === 0 ) {
                ary.splice(idx, 1);
                if ( ary.length ) {
                    oFiles[ary[0]] = getSrcFileObject(ary[0], tag);         // 添加次文件对象
                    bus.at('组件编译缓存', ary[0], false);                   // 不应该的事，保险起见清除该编译缓存
                }else{
                    delete oTagFiles[tag];
                }
            }
        }

        if ( !tag || !oFile) return;                                        // 无关文件的删除

        // 删除关联编译缓存，重新编译
        refFiles.forEach(file => {
            bus.at('组件编译缓存', file, false);                             // 删除关联页面的编译缓存
            removeHtmlCssJsFile(file);
        });
        bus.at('组件编译缓存', oFile.file, false);                           // 删除当前文件的编译缓存
        removeHtmlCssJsFile(oFile.file);

        await bus.at('全部编译');
    });


    bus.on('SVG文件删除', async function(svgfile){
        await bus.at('重新编译和该SVG可能相关的组件和页面', svgfile);
    });

    bus.on('图片文件删除', async function(imgfile){

        // 图片文件删除时，处理等同图片文件修改
        await bus.at('图片文件修改', imgfile);
    });

    bus.on('重新编译和该SVG可能相关的组件和页面', async function(svgfile){

        // 如果是图表目录中的文件，简化的，但凡用到图标的组件和页面，统统重新编译
        let env = bus.at('编译环境');

        let oSetFiles = new Set(), oSetPages = new Set();
        let oFiles = bus.at('源文件对象清单');
        let pages;
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file);
            if ( context ) {

                // 可能是图标用途的svg文件
                if ( svgfile.startsWith(env.path.svgicons + '/') ) {
                    if ( context.result.hasSvgIcon ) {
                        oSetFiles.add(file);                                    // 直接使用图标的组件
                        pages = getRefPages(getTagOfSrcFile(file));
                        pages.forEach(f => oSetPages.add(f));                   // 使用本组件的页面

                        continue;
                    }
                }

                // 可能是图片用途的svg文件
                let refimages = context.result.refimages || [];
                if ( refimages.includes(svgfile) ) {
                    oSetFiles.add(file);                                        // 使用该svg作为图片用途的组件
                    pages = getRefPages(getTagOfSrcFile(file));
                    pages.forEach(f => oSetPages.add(f));                       // 使用本组件的页面
                }
            }
        }

        oSetPages.forEach(file => {
            bus.at('组件编译缓存', file, false);                                // 清除编译缓存
            removeHtmlCssJsFile(file);
        });
        oSetFiles.forEach(file => {
            bus.at('组件编译缓存', file, false);                                // 清除编译缓存
        });

        await bus.at('全部编译');
    });


})();

// 取标签名，无效者undefined
function getTagOfSrcFile(file){
    let name = File.name(file);
    if ( /[^a-zA-Z0-9_-]/.test(name) || !/^[a-zA-Z]/.test(name) ) {
        return;
    }
    return name.toLowerCase();
}


// 文件改变时，先删除生成的最终html等文件
function removeHtmlCssJsFile(file){

    let fileHtml = bus.at('页面目标HTML文件名', file);
    let fileCss = bus.at('页面目标CSS文件名', file);
    let fileJs = bus.at('页面目标JS文件名', file);

    File.remove(fileHtml);
    File.remove(fileCss);
    File.remove(fileJs);

}

