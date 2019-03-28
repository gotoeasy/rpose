const bus = require('@gotoeasy/bus');
const os = require('@gotoeasy/os');
const hash = require('@gotoeasy/hash');
const File = require('@gotoeasy/file');

(function (fileSet){

    bus.on('源文件清单', function(){

        if ( !fileSet ) {
            let env = bus.at('编译环境');
            let files = File.files(env.path.src, '**.rpose');                   // 源文件目录
//                let buildinfiles = File.files(env.path.src_buildin, '**.rpose');    // 内置源文件目录
//                files.unshift(...buildinfiles);                                     // 添加到数组起始位置
            fileSet = new Set(files);
            return [...fileSet];
        }

        return [...fileSet];
    });

    bus.on('源文件添加', function(file, text, hashcode){
console.time('build');
        fileSet.add(file);
        bus.at('编译组件', file, text, hashcode);   // 重新编译
console.timeEnd('build');
    });

    bus.on('源文件删除', function(file){
console.time('build');
        fileSet.delete(file);
        bus.at('组件编译缓存', file, false);   // 删除该文件编译缓存

        // TODO 删除页面
        let refFiles = getRefPages(file);
        refFiles.forEach(refFile => {
            let text, hashcode, context = bus.at('组件编译缓存', refFile);
            if ( context ) {
                text = File.read(refFile);
                hashcode = hash(text);
            }else{
                text = File.read(refFile);
                hashcode = hash(text);
            }
            bus.at('组件编译缓存', refFile, false);     // 删除该文件相应缓存
            bus.at('编译组件', refFile, text, hashcode);
        });

console.timeEnd('build');
    });

    bus.on('源文件修改', function(file, text, hashcode){
console.time('build');

        let context = bus.at('组件编译缓存', file);
        if ( context ) {
            if ( context.input.hashcode !== hashcode ) {
                bus.at('组件编译缓存', file, false);        // 删除该文件相应缓存
                bus.at('编译组件', file, text, hashcode);   // 重新编译
            }else{
                return;
            }
        }

        let refFiles = getRefPages(file);
        refFiles.forEach(refFile => {
            let txt, hcode, context = bus.at('组件编译缓存', refFile);
            if ( context ) {
                txt = File.read(refFile);
                hcode = hash(text);
            }else{
                txt = File.read(refFile);
                hcode = hash(text);
            }
            bus.at('组件编译缓存', refFile, false);     // 删除该文件相应缓存
            bus.at('编译组件', refFile, txt, hcode);
        });

console.timeEnd('build');
    });


})();


function getRefPages(file){

    let tagpkg = bus.at('标签全名', file);

    let refFiles = [];
    let files = bus.at('源文件清单');
    files.forEach(srcFile => {
        if ( srcFile !== file ){
            let context = bus.at('组件编译缓存', srcFile);
            if ( context ) {
                let allreferences = context.result.allreferences || [];
                if ( allreferences.includes(tagpkg) ) {
                    refFiles.push(srcFile);
                }
            }
        }
    });
    
    return refFiles;
}
