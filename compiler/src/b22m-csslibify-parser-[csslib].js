const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const findNodeModules = require('find-node-modules');

bus.on('解析[csslib]', function(){

    // 仅解析和简单验证，不做安装和定义等事情
    return function parseCsslib(obj, file, text){

        let rs = {};
        let csslibBlockText = obj.value || '';
        if ( !csslibBlockText.trim()  ) {
            return rs;
        }

        let lines = csslibBlockText.split('\n');
        for ( let i=0,csslib,oCsslib; i<lines.length; i++ ) {
            csslib = lines[i].split('//')[0].trim();                                        // 去除注释内容
            if ( !csslib ) continue;                                                        // 跳过空白行

            oCsslib = bus.at('解析csslib', csslib, file);
            let pos = getStartPos(lines, i, obj.loc.start.pos);                             // taglib位置

            // 无效的csslib格式
            if ( !oCsslib ) {
                throw new Err('invalid csslib: ' + csslib, { file, start: pos.start, end: pos.end });
            }

            oCsslib.pos = pos;                                                              // 顺便保存位置，备用  TODO 位置

            // 设定目标目录的绝对路径
            let dir;
            if ( oCsslib.pkg.startsWith('~') ) {
                // 如果是目录，检查目录是否存在
                let root = bus.at('文件所在项目根目录', file);
                dir = oCsslib.pkg.replace(/\\/g, '/').replace(/^~\/*/, root + '/');
                if ( !File.existsDir(dir) ) {
                    throw new Err('folder not found [' + dir + ']', { file, text, start: oCsslib.pos.start, end: oCsslib.pos.end });
                }
            }else{
                // 自动安装
                if ( !bus.at('自动安装', oCsslib.pkg) ) {
                    throw new Err('package install failed: ' + oCsslib.pkg, { file, text, start: oCsslib.pos.start, end: oCsslib.pos.end });
                }
                
                dir = getNodeModulePath(oCsslib.pkg);
                if ( !dir ) {
                    // 要么安装失败，或又被删除，总之不应该找不到安装位置
                    throw new Err('package install path not found: ' + oCsslib.pkg, { file, text, start: oCsslib.pos.start, end: oCsslib.pos.end });
                }
            }
            oCsslib.dir = dir;   // 待导入的样式文件存放目录


            // 重复的csslib别名
            if ( rs[oCsslib.alias] ) {
                throw new Err('duplicate csslib name: ' + oCsslib.alias, { file, start: pos.start, end: pos.endAlias });
            }

            rs[oCsslib.alias] = oCsslib;
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

// 找不到时返回undefined
function getNodeModulePath(npmpkg){
    let node_modules = [...findNodeModules({ cwd: process.cwd(), relative: false }), ...findNodeModules({ cwd: __dirname, relative: false })];
    for ( let i=0,modulepath,dir; modulepath=node_modules[i++]; ) {
        dir = File.resolve(modulepath, npmpkg);
        if ( File.existsDir(dir) ) {
            return dir;
        }
    }
}
