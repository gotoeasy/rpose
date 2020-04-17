const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');

bus.on('生成SVG内联SYMBOL定义代码', function (){

    return function(srcFile){

        // 汇总用到的全部图标文件，有重名时将报错
        let oInlineSymbolSvgs = getInlineSymbolSvgFiles(srcFile);

        // 排序收集图标文件信息
        let pkgs = Object.keys(oInlineSymbolSvgs);
        pkgs.sort();
        let oFiles = [];
        pkgs.forEach(pkg => {
            let oSvgFiles = oInlineSymbolSvgs[pkg];
            let keys = Object.keys(oSvgFiles);
            keys.sort();
            keys.forEach( key => oFiles.push(oSvgFiles[key]) );
        });

        // 输出
        let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
        let text, symbolId
        oFiles.forEach(oFile => {
            text = File.read(oFile.file);
            symbolId = hash(oFile.pkg) + '_' + oFile.name;                                          // 用包名哈希码为前缀作id
            rs.push(bus.at('SVG转SYMBOL定义', text, symbolId));
        });
        rs.push( '</svg>' );

        return rs.join('\n');
    }

}());


bus.on('生成SVG引用内联SYMBOL', function (){

    return function(fileOrExpr, srcFile, props={}){
        let attrs = [];
        for ( let key in props ) {
            attrs.push(`${key}="${props[key]}"`);
        }

        let pkg = bus.at('文件所在模块', srcFile);
        let hashcode = hash(pkg);

        let href;
        if ( bus.at('是否表达式', fileOrExpr) ) {
            let expr = fileOrExpr.substring(1, fileOrExpr.length-1);
            hashcode = hash('/');                                                           // FIX: 动态图标名的时候，只使用当前工程的图标 TODO
            href = `{'#${hashcode}_' + (${expr}) }`;

            !props.height && attrs.push(`height="${props.width || 16}"`);
            !attrs.width && attrs.push(`width="${props.height || 16}"`);
        }else{
            let name = File.name(fileOrExpr);                                               // 使用文件名作为id （TODO 冲突）
            href = `{'#${hashcode}_${name}'}`;

            // TODO 自动按比例调整宽度
            !props.height && attrs.push(`height="${props.width || 16}"`);
            !attrs.width && attrs.push(`width="${props.height || 16}"`);
        }


        return `<svg ${attrs.join(' ')}><use xlink:href=${href}></use></svg>`;
    }

}());

function getInlineSymbolSvgFiles(srcFile){

    let oPkgSvgFiles = {};
    let oSetPkg = new Set();

    inlineSymbolSvgFiles(oPkgSvgFiles, oSetPkg, srcFile);

    let context = bus.at('组件编译缓存', srcFile);
    let allreferences = context.result.allreferences;
    for ( let i=0,tagpkg; tagpkg=allreferences[i++]; ) {
        let tagSrcFile = bus.at('标签源文件', tagpkg);
        inlineSymbolSvgFiles(oPkgSvgFiles, oSetPkg, tagSrcFile);
    }

    return oPkgSvgFiles;
}


// 汇总 srcFile 所在包的图标文件（配置目录+配置导入）
// oPkgSvgFiles: {pkg: {file: {位置信息}} }
function inlineSymbolSvgFiles(oPkgSvgFiles, oSetPkg, srcFile){

    let context = bus.at('组件编译缓存', srcFile);
    if ( !context ) return;

    let pkg = bus.at('文件所在模块', srcFile);
    if ( !oSetPkg.has(pkg) ) {
        // 汇总图标
        if ( context.result.hasDinamicSvg ) {
            let oFiles = bus.at('项目SVG图标文件列表', context.input.file);                              // {files, pkg}

            let oSvgFiles = oPkgSvgFiles[pkg] = oPkgSvgFiles[pkg] || {};                                // {name: oFile}
            for ( let i=0,oFile; oFile=oFiles.files[i++]; ) {
                oSvgFiles[oFile.name] = {...oFile, pkg};                                                // 保存包名信息
            }
            oSetPkg.add(pkg);                                                                           // 此包已处理
        }
    }

}
