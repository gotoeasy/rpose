const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

// --------------------------------------------
// 多个svg图标，一个个if/else判断是否显示
// 使用正则判断，并处理正则特殊字符
// --------------------------------------------
bus.on('动态判断显示SVG标签', function (){

    return function(expr, srcFile){

        let oFiles = bus.at('项目SVG图标文件列表', srcFile);
        if ( !oFiles.files.length ) {
            // 没有找到图标文件
            throw new Error(`svg icon file not found`);
        }

        expr = expr.replace(/^\s*{/, '(').replace(/}\s*$/, ')');
        let texts = [];
        for ( let i=0,oFile,regstr; oFile=oFiles.files[i++]; ) {
            regstr = `${oFile.name.replace(/[{}()[\]^$+.-]/g, '\\$&')}(.svg)?`;              // 正则相关文件名中的特殊字符替换（通常不该有特殊字符，以防万一避免出错，处理一下）

            if ( i > 1 ) {
                texts.push(`{% else if ( /^${regstr}$/i.test(${expr}) ){ %}`);
            }else{
                texts.push(`{% if ( /^${regstr}$/i.test(${expr}) ){ %}`);
            }
            texts.push( File.read(oFile.file) );
            texts.push(`{% } %}`);
        }

        return texts.join('\n');
    }

}());
