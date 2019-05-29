const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const csslibify = require('csslibify');

(function (mapFileCsslibs=new Map()){

    // 参数oCsslib为样式库定义信息对象
    // 返回样式库对象
    bus.on('样式库', function (oCsslib, fromFile){

        // 导入处理
        let cssfiles = [];                                                                  // 待导入的css文件数组
        oCsslib.filters.forEach(filter => {
            cssfiles.push( ...File.files(oCsslib.dir, filter) );                            // 逐个过滤筛选，确保按过滤器顺序读取文件
        });

        let text = [];
        cssfiles.forEach( cssfile => text.push(File.read(cssfile)) );
        let textid = hash(text.join('\n'));                                                 // 文件内容哈希ID

        let pkg = oCsslib.pkg;                                                              // 样式库包名
        if ( pkg.startsWith('~') ) {
            pkg = 'dir_' + textid;                                                          // 本地目录样式库时，添加文件内容哈希ID后缀作为包名(用以支持导入不同文件或修改文件内容而不产生冲突)

            let env = bus.at('编译环境');
            if ( env.watch ) {
                let ary = mapFileCsslibs.get(fromFile) || [];
                mapFileCsslibs.set(fromFile, ary);
                oCsslib.cssfiles = cssfiles;                                                // 文件存起来方便比较
                ary.push(oCsslib);                                                          // 如果是文件监视模式，把本地样式库的配置都存起来，便于样式文件修改时判断做重新编译
            }

        }else{
            pkg += '_' + textid;                                                            // npm包时，添加文件内容哈希ID后缀作为包名(用以支持导入不同文件或更改版本而不产生冲突)
        }

        let csslib = csslibify(pkg, oCsslib.alias, textid);                                 // 用文件内容作为样式库的缓存ID（会浅复制更新包名和别名）

        if ( !csslib._imported.length ) {
            for ( let i=0; i<text.length; i++ ) {
                csslib.imp(text[i++]);                                                      // 未曾导入时，做导入，直接使用已读内容
            }
        }

        csslib.isEmpty = !cssfiles.length;                                                  // 保存标志便于判断

        return csslib;
    });

    bus.on('CSS文件添加', async function (){

        let configFile, srcFiles = [];

        // 全部样式库都按过滤器重新筛选检查，看样式文件列表是否一致
        mapFileCsslibs.forEach((ary, fromFile) => {
            for ( let i=0,oCsslib,files; oCsslib=ary[i++]; ) {
                files = [];
                oCsslib.filters.forEach(filter => {
                    files.push( ...File.files(oCsslib.dir, filter) );                       // 重新逐个过滤筛选
                });
                if ( files.join('') !== oCsslib.cssfiles.join('') ) {
                    // 不一样了，该fromFile关联组件要重新编译
                    if ( fromFile.endsWith('/rpose.config.btf') ) {
                        configFile = fromFile;
                    }else{
                        srcFiles.push(fromFile);
                    }
                    break;
                }
            }
        });

        if ( configFile ) {
            // 影响到了项目配置文件的[csslib]样式库配置，全部重新编译吧
            mapFileCsslibs.clear();
            await bus.at('全部重新编译');
            return;
        }else{
            // 影响到了相关组件文件的[csslib]或@csslib样式库配置，关联组件都重新编译
            await rebuildAllReferances(...srcFiles);
        }

    });

    bus.on('CSS文件修改', async function (cssFile){

        let configFile, srcFiles = [];

        // 全部样式库逐个检查文件列表是否包含被变更的css文件
        mapFileCsslibs.forEach((ary, fromFile) => {
            for ( let i=0,oCsslib; oCsslib=ary[i++]; ) {
                if ( oCsslib.cssfiles.includes(cssFile) ) {
                    if ( fromFile.endsWith('/rpose.config.btf') ) {
                        configFile = fromFile;
                    }else{
                        srcFiles.push(fromFile);
                    }
                    break;
                }
            }
        });

        if ( configFile ) {
            // 影响到了项目配置文件的[csslib]样式库配置，全部重新编译吧
            mapFileCsslibs.clear();
            await bus.at('全部重新编译');
            return;
        }else{
            // 影响到了相关组件文件的[csslib]或@csslib样式库配置，关联组件都重新编译
            await rebuildAllReferances(...srcFiles);
        }

    });

    bus.on('CSS文件删除', async function (){
        // 和CSS文件添加是一样的处理逻辑
        await bus.at('CSS文件添加');
    });

})();


// 相关组件页面全部重新编译
async function rebuildAllReferances(...srcFiles){

    if ( !srcFiles.length ) return;

    let pageFiles = bus.at('组件相关页面源文件', ...srcFiles);

    // 清除页面组件编译缓存，删除已编译的html等文件
    pageFiles.forEach(file => {
        bus.at('组件编译缓存', file, false);
        removeHtmlCssJsFile(file);
    });

    // 清除组件编译缓存
    srcFiles.forEach(file => bus.at('组件编译缓存', file, false) );

    await bus.at('全部编译');
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
