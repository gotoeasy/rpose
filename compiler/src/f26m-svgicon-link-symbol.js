const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');

(function (oFiles={}){

    bus.on('生成外部SYMBOL定义文件', function (srcFile){

        let filename = bus.at('外部SYMBOL文件名', srcFile);

        if ( !oFiles[filename] ) {
            let env = bus.at("编译环境");
            let file = (env.path.build_dist + '/' + env.path.build_dist_images + '/' + filename).replace(/\/\//g, '/');
            let text = bus.at('外部SYMBOL文件内容', srcFile);
            File.write(file, text);
            oFiles[filename] = true;
        }

        return filename;
    });


    bus.on('生成SVG引用外部SYMBOL', function (fileOrExpr, srcFile, props){

        let attrs = [];
        for ( let key in props ) {
            attrs.push(`${key}="${props[key]}"`);
        }

        let href;
        if ( bus.at('是否表达式', fileOrExpr) ) {
            let expr = fileOrExpr.substring(1, fileOrExpr.length-1);
            href = `{'%svgsymbolfile%#' + (${expr}) }`;
        }else{
            let symbolId = File.name(fileOrExpr);                                                           // 使用文件名作为id （TODO 冲突）
            href = `{'%svgsymbolfile%#${symbolId}'}`;
        }
        return `<svg ${attrs.join(' ')}><use xlink:href=${href}></use></svg>`;

    });

    bus.on('外部SYMBOL文件内容', function (srcFile){
        let files = bus.at('项目SVG图标文件列表', srcFile);

        let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
        let text, symbolId, oSetIds = new Set();
        files.forEach(file => {
            text = File.read(file);
            symbolId = File.name(file);
            !oSetIds.has(symbolId) && rs.push(bus.at('SVG转SYMBOL定义', text, symbolId));                             // 需要适当的转换处理，使用文件内容哈希码作为id
            oSetIds.add(symbolId);
        });
        rs.push( '</svg>' );

        return rs.join('\n');
    });

    bus.on('外部SYMBOL文件名', function (srcFile){
        // 模块名（当前工程时为‘/’）
        let pkg = bus.at('文件所在模块', srcFile);
        return 'symbols-' + hash(pkg) + '.svg';
    });

}());


