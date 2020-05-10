const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');

(function (oFiles={}, hashLinkSymbol){

    bus.on('生成各关联包的外部SYMBOL定义文件', function (context){

        let pkg, oPkgFile = {};
        if ( context.result.hasSvgLinkSymbol ) {
            pkg = bus.at('文件所在模块', context.input.file);
            oPkgFile[pkg] = context.input.file;
        }

        let allreferences = context.result.allreferences;
        for ( let i=0,tagpkg,ctx; tagpkg=allreferences[i++]; ) {
            let tagSrcFile = bus.at('标签源文件', tagpkg);
            ctx = bus.at('组件编译缓存', tagSrcFile);
            if ( ctx && ctx.result.hasSvgLinkSymbol ){
                pkg = bus.at('文件所在模块', tagSrcFile);
                oPkgFile[pkg] = tagSrcFile;
            }
        }

        for ( let pkg in oPkgFile ) {
            bus.at('生成外部SYMBOL定义文件', oPkgFile[pkg]);
        }

    });

    bus.on('生成外部SYMBOL定义文件', function (srcFile){

        // 模块名（当前工程时为‘/’）
        let pkg = bus.at('文件所在模块', srcFile);
        let filename = bus.at('外部SYMBOL文件名', srcFile);

        if ( !oFiles[filename] ) {                                                                                          // TODO: FIXME  表达式外部文件，以工程文件优先
            let env = bus.at("编译环境");
            let file = (env.path.build_dist + '/' + env.path.build_dist_images + '/' + filename).replace(/\/\//g, '/');
            let text = bus.at('外部SYMBOL文件内容', srcFile);

            if ( pkg === '~'  ) {
                // 当前工程时，如果内容相同，不重复写文件
                let hashcode = hash(text);
                if ( hashLinkSymbol !== hashcode ) {
                    File.write(file, text);
                    hashLinkSymbol = hashcode;
                }
            }else{
                // npm包的话，写一次就够了
                File.write(file, text);
                oFiles[filename] = true;
            }
        }

    });

    bus.on('生成SVG引用外部SYMBOL', function (fileOrExpr, srcFile, props){

        let attrs = [];
        for ( let key in props ) {
            attrs.push(`${key}="${props[key]}"`);
        }

        let symbolFile = bus.at('外部SYMBOL文件名', srcFile);

        let href;
        if ( bus.at('是否表达式', fileOrExpr) ) {
            let expr = fileOrExpr.substring(1, fileOrExpr.length-1);
            href = `{'%svgsymbolpath%${symbolFile}#' + (${expr}) }`;                                        // TODO: FIXME  表达式外部文件，以工程文件优先

            !props.height && attrs.push(`height="${props.width || '1em'}"`);
            !attrs.width && attrs.push(`width="${props.height || '1em'}"`);
        }else{
            let symbolId = File.name(fileOrExpr);                                                           // 使用文件名作为id （TODO 冲突）
            href = `{'%svgsymbolpath%${symbolFile}#${symbolId}'}`;

            // 自动按比例调整宽度
            !props.height && attrs.push(`height="${props.width || '1em'}"`);
            !attrs.width && attrs.push(`width="${props.height || '1em'}"`);
        }

        return `<svg ${attrs.join(' ')}><use xlink:href=${href}></use></svg>`;

    });

    bus.on('外部SYMBOL文件内容', function (srcFile){
        let oFiles = bus.at('项目SVG图标文件列表', srcFile);
        oFiles.files.sort((f1,f2) => f1.file > f2.file);

        let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
        let text, symbolId;
        oFiles.files.forEach(oFile => {
            text = File.read(oFile.file);
            symbolId = oFile.name;
            rs.push(bus.at('SVG转SYMBOL定义', text, symbolId));                             // 需要适当的转换处理，使用文件内容哈希码作为id
        });
        rs.push( '</svg>' );

        return rs.join('\n');
    });


    bus.on('外部SYMBOL文件名', function (srcFile){
        // 模块名（当前工程时为‘/’）
        let pkg = bus.at('文件所在模块', srcFile);
        return 'symbols-' + hash(pkg) + '.svg';                             // 外部SYMBOL文件名
    });

}());


