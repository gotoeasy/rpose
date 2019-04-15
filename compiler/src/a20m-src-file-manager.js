const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
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

    bus.on('源文件添加', function(oFile){

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

        oFiles[oFile.file] = getSrcFileObject(oFile.file, tag);                           // 第一个有效
        return bus.at('全部编译');

    });

    bus.on('源文件修改', function(oFileIn){

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
            writeInfoPage(file, `rebuilding for component [${tag}] changed`);
        });
        bus.at('组件编译缓存', oFile.file, false);                          // 删除当前文件的编译缓存
        return bus.at('全部编译');
    });

    bus.on('源文件删除', function(file){

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
            writeInfoPage(file, `rebuilding for component [${tag}] removed`);
        });
        bus.at('组件编译缓存', oFile.file, false);                           // 删除当前文件的编译缓存
        return bus.at('全部编译');
    });




})();

// 取标签名，无效者undefined
function getTagOfSrcFile(file){
    let name = File.name(file);
    if ( /[^a-zA-Z0-9_\-]/.test(name) || !/^[a-zA-Z]/.test(name) ) {
        return;
    }
    return name.toLowerCase();
}


function writeInfoPage(file, msg){

    let fileHtml = bus.at('页面目标HTML文件名', file);
    let fileCss = bus.at('页面目标CSS文件名', file);
    let fileJs = bus.at('页面目标JS文件名', file);

    if ( File.existsFile(fileHtml) ) {
        File.write(fileHtml, syncHtml(msg));   // html文件存在，可能正被访问，要替换
        File.remove(fileCss);
        File.remove(fileJs);
    }

}


// 在watch模式下，文件改变时，生成的html文件不删除，便于浏览器同步提示信息
function syncHtml(msg=''){
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>Page build failed or src file removed<p/>
        <pre style="background:#333;color:#ddd;padding:10px;">${msg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </body>`;
}
