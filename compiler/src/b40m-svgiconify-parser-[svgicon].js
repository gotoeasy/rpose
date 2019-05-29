const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const resolvepkg = require('resolve-pkg');

bus.on('解析[svgicon]', function(){

    // 解析、安装、检查重名
    return function(obj, prjCtx){

        let rs = {};

        // -------------------------------------------
        // 无定义则跳过
        let svgiconBlockText = obj.value || '';
        if ( !svgiconBlockText.trim()  ) {
            return rs;
        }

        // -------------------------------------------
        // 解析、安装、查询文件、起别名、检查重名
        let lines = svgiconBlockText.split('\n');
        for ( let i=0,svgicon,oSvgicon; i<lines.length; i++ ) {
            svgicon = lines[i].split('//')[0].trim();                                        // 去除注释内容
            if ( !svgicon ) continue;                                                        // 跳过空白行

            oSvgicon = bus.at('解析svgicon', svgicon);
            let pos = getStartPos(lines, i, obj.pos.start);                                 // taglib位置

            // 无效的svgicon格式
            if ( !oSvgicon ) {
                throw new Err('invalid svgicon define (' + svgicon + ')', { ...prjCtx.input, ...pos });
            }

            oSvgicon.pos = pos;                                                              // 顺便保存位置，备用

            // 自动安装
            if ( !bus.at('自动安装', oSvgicon.pkg) ) {
                throw new Err('package install failed: ' + oSvgicon.pkg, { ...prjCtx.input, ...pos });
            }

            let svgFilter = /\.svg$/i.test(oSvgicon.filter) ? oSvgicon.filter : (oSvgicon.filter + '.svg');                     // 仅查找svg文件
            svgFilter = svgFilter.replace(/\\/g, '/');

            let files = File.files(resolvepkg(oSvgicon.pkg), svgFilter);
            if ( files.length > 1 ) {
                throw new Err('mulit svg file found\n  ' + files.join('\n  '), { ...prjCtx.input, ...pos });
            }
            if ( !files.length ) {
                // 任意目录下再找一遍
                svgFilter = ('**/' + svgFilter).replace(/\/\//g, '/');
                files = File.files(resolvepkg(oSvgicon.pkg), svgFilter);
                if ( files.length > 1 ) {
                    throw new Err('mulit svg file found\n  ' + files.join('\n  '), { ...prjCtx.input, ...pos });
                }
                if ( !files.length ) {
                    throw new Err('svg file not found', { ...prjCtx.input, ...pos });
                }
            }

            oSvgicon.file = files[0];
            let alias = oSvgicon.alias === '*' ? File.name(oSvgicon.file).toLowerCase() : oSvgicon.alias.toLowerCase();

            // 项目配置本身的图标别名不能重复，无重复则通过，以便尽快成功解析配置文件
            if ( rs[alias] ) {
                throw new Err(`duplicate icon name (${alias})`, { ...prjCtx.input, start: pos.start, end: pos.endAlias });
            }
            rs[alias] = oSvgicon;
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
    let match = line.match(/^\s+/);
    match && (start += match[0].length);                                // 加上别名前的空白长度

    let end = start + line.trim().length;                               // 结束位置不含注释

    let endAlias = end, idx = line.indexOf('=');
    if ( idx > 0 ) {
        endAlias = start + line.substring(0, idx).trim().length;        // 有等号时的别名长度
    }

    return {start, end, endAlias};
}

