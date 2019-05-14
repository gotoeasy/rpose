const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('解析[taglib]', function(){

    // 仅解析和简单验证，不做安装和定义等事情
    return function parseTaglib(obj, file){

        let rs = {};
        let taglibBlockText = obj.value || '';
        if ( !taglibBlockText.trim()  ) {
            return rs;
        }

        let lines = taglibBlockText.split('\n');
        for ( let i=0,taglib,oTaglib; i<lines.length; i++ ) {
            taglib = lines[i].split('//')[0].trim();                                        // 去除注释内容
            if ( !taglib ) continue;                                                        // 跳过空白行

            oTaglib = bus.at('解析taglib', taglib);
            let pos = getStartPos(lines, i, obj.loc.start.pos);                             // taglib位置

            // 无效的taglib格式
            if ( !oTaglib ) {
                throw new Err('invalid taglib: ' + taglib, { file, start: pos.start, end: pos.end });
            }

            oTaglib.pos = pos;                                                              // 顺便保存位置，备用  TODO 位置

            // 无效的taglib别名
            if ( /^@?(if|for|svgicon)$/i.test(oTaglib.astag) ) {
                throw new Err('can not use buildin tag name: ' + oTaglib.astag, { file, start: pos.start, end: pos.endAlias });
            }

            // 重复的taglib别名 (仅@前缀差异也视为冲突)
            if ( rs[oTaglib.atastag] || rs[oTaglib.astag] ) {
                throw new Err('duplicate tag name: ' + oTaglib.astag, { file, start: pos.start, end: pos.endAlias });
            }

            rs[oTaglib.atastag] = oTaglib;
            rs[oTaglib.astag] = oTaglib;
        }

        return rs;
    }


}());

function getStartPos(lines, lineNo, offset){

    let start = offset;
    for ( let i=0; i<lineNo; i++ ) {
        start += lines[i].length + 1;                                   // 行长度=行内容长+换行符
    }
    
    let line = lines[lineNo].split('//')[0];                            // 不含注释
    let match = line.match(/\s+/);
    match && (start += match[0].length);                                // 加上别名前的空白长度

    let end = start + line.trim().length;                               // 结束位置不含注释

    let endAlias = end, idx = line.indexOf('=');
    if ( idx > 0 ) {
        endAlias = start + line.substring(0, idx).trim().length;        // 有等号时的别名长度
    }

    return {start, end, endAlias};
}