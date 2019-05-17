const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const csslibify = require('csslibify');

bus.on('样式库', function(){
    
    // 参数oCsslib为样式库定义信息对象
    // 返回样式库对象
    return function (oCsslib){

        // 导入处理
        let cssfiles = File.files(oCsslib.dir, ...oCsslib.filters);                         // 待导入的css文件数组
        let libid = hash( JSON.stringify(['样式库缓存用ID', oCsslib.pkg, cssfiles]) );       // 样式库缓存用ID【实际包名：文件列表】

        let pkg = oCsslib.pkg;                                                              // 样式库包名
        if ( pkg.startsWith('~') ) {
            pkg = 'dir-' + hash(oCsslib.dir);                                               // 本地目录样式库时，用目标目录的绝对路径进行哈希生成包名(用相对路径可能导致重名)
        }

        let csslib = csslibify(pkg, oCsslib.alias, libid);
        !csslib._imported.length && cssfiles.forEach( cssfile => csslib.imp(cssfile) );     // 未曾导入时，做导入
        
        return csslib;
    }

}());

