const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

bus.on('解析[taglib]', function(){

    // 仅解析和简单验证，不做安装和定义等事情
    return function parseTaglib(taglibBlockText, context, loc){
        let rs = {};
        let lines = (taglibBlockText == null ? '' : taglibBlockText.trim()).split('\n');
        let offsetLine = (loc ? loc.start.line : 0) + 1;                                    // [taglib]占了一行所以+1

        for ( let i=0,taglib,oTaglib; i<lines.length; i++ ) {
            taglib = lines[i].split('//')[0].trim();                                        // 去除注释内容
            if ( !taglib ) continue;                                                        // 跳过空白行

            oTaglib = bus.at('normalize-taglib', taglib, i);

            // 无效的taglib格式
            if ( !oTaglib ) {
                if ( loc ) {
                    throw new Err('invalid taglib: ' + taglib, { file: context.input.file, text: context.input.text, line: offsetLine + i });
                }
                throw new Err(`invalid taglib: ${taglib}`);
            }

            // 无效的taglib别名
            if ( /^@?(if|for|svgicon)$/i.test(oTaglib.astag) ) {
                if ( loc ) {
                    throw new Err('can not use buildin tag name: ' + oTaglib.astag, { file: context.input.file, text: context.input.text, line: offsetLine + i });
                }
                throw new Err('can not use buildin tag name: ' + oTaglib.astag);
            }

            // 重复的taglib别名 (仅@前缀差异也视为冲突)
            if ( rs[oTaglib.atastag] || rs[oTaglib.astag] ) {
                if ( loc ) {
                    throw new Err('duplicate tag name: ' + oTaglib.atastag + '/' + oTaglib.astag, { file: context.input.file, text: context.input.text, line: offsetLine+ i });
                }
                throw new Err('duplicate tag name: ' + oTaglib.atastag + '/' + oTaglib.astag);
            }

            rs[oTaglib.atastag] = oTaglib;
            rs[oTaglib.astag] = oTaglib;
        }

        return rs;
    }


}());
