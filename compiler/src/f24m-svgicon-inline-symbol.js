const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

bus.on('生成SVG内联SYMBOL定义代码', function (){

    return function(srcFile){

        let files = bus.at('项目SVG图标文件列表', srcFile);

        let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
        let text, symbolId, oSetIds = new Set();
        files.forEach(file => {
            text = File.read(file);
            symbolId = File.name(file);
            !oSetIds.has(symbolId) && rs.push(bus.at('SVG转SYMBOL定义', text, symbolId));
            oSetIds.add(symbolId);
        });
        rs.push( '</svg>' );

        return rs.join('\n');
    }

}());


bus.on('生成SVG引用内联SYMBOL', function (){

    return function(fileOrExpr, props={}){
        let attrs = [];
        for ( let key in props ) {
            attrs.push(`${key}="${props[key]}"`);
        }

        let href;
        if ( bus.at('是否表达式', fileOrExpr) ) {
            let expr = fileOrExpr.substring(1, fileOrExpr.length-1);
            href = `{'#' + (${expr}) }`;
        }else{
            let symbolId = File.name(fileOrExpr);                                               // 使用文件名作为id （TODO 冲突）
            href = `{'#${symbolId}'}`;
        }
        return `<svg ${attrs.join(' ')}><use xlink:href=${href}></use></svg>`;
    }

}());

