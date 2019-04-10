const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const csslibify = require('csslibify');

bus.on('样式库', function(rs={}){
    
    // ------------------------------------------------------------------------------------------------------
    // 此编译模块用的样式库建库方法，定义后就按需使用，中途不会作样式库的修改操作
    // 使用【包名：文件列表】作为缓存用的样式库名称，以提高性能
    // 如，foo=pkg:**.min.css和bar=pkg:**/*.min.css，实际使用同一样式库
    // 
    // 样式库实例通过返回值取得后自行管理 （参数中传入的name部分被无视）
    // 
    // 【 使用 】
    // bus.at('样式库', 'defaultname=pkg:**.min.css')
    // bus.at('样式库', 'pkg:**.min.css')
    // bus.at('样式库', 'pkg')
    // 
    // 【 defCsslib 】
    //   *=pkg:**/**.min.js
    //   name=pkg:**/aaa*.min.js, **/bbb*.min.js
    //   name=pkg
    //   pkg:**/**.min.js
    //   pkg
    return function (defCsslib){

        let match;
        let name, pkg, filters = [];
        if ( (match = defCsslib.match(/^(.*?)=(.*?):(.*)$/)) ) {
            // name=pkg:filters
            name = match[1].trim();
            pkg = match[2].trim();
            cssfilter = match[3];
            cssfilter.replace(/;/g, ',').split(',').forEach(filter => {
                filter = filter.trim();
                filter && filters.push(filter);
            });
        }else if ( (match = defCsslib.match(/^(.*?)=(.*)$/)) ) {
            // name=pkg
            name = match[1].trim();
            pkg = match[2].trim();
            filters.push('**.min.css');                                                     // 默认取npm包下所有压缩后文件*.min.css
        }else if ( (match = defCsslib.match(/^(.*?):(.*)$/)) ) {
            // pkg:filters
            name = '*';
            pkg = match[1].trim();
            cssfilter = match[2];
            cssfilter.replace(/;/g, ',').split(',').forEach(filter => {
                filter = filter.trim();
                filter && filters.push(filter);
            });
        }else{
            // pkg
            name = '*';
            pkg = defCsslib.trim();
            filters.push('**.min.css');                                                     // 默认取npm包下所有压缩后文件*.min.css
        }

        // 导入处理
        pkg.lastIndexOf('@') > 1 && ( pkg = pkg.substring(0, pkg.lastIndexOf('@')) );       // 模块包名去除版本号 （通常不该有，保险起见处理下）
        (!name || name === '*') && (pkg = '');                                              // 没有指定匿名，或指定为*，按无库名处理（用于组件范围样式）
        let dir, env = bus.at('编译环境');
        if ( pkg.startsWith('$') ) {
            dir = env.path.root + '/' + pkg;                                                // pkg以$开头时优先查找本地目录
            !File.existsDir(dir) && (dir = env.path.root + '/' + pkg.substring(1));         // 次优先查找去$的本地目录
        }
        (!dir || !File.existsDir(dir)) && (dir = getNodeModulePath(pkg));                   // 本地无相关目录则按模块处理，安装指定npm包返回安装目录
        
        let cssfiles = File.files(dir, ...filters);                                         // 待导入的css文件数组
        let libid = hash( JSON.stringify([pkg, cssfiles]) );                                // 样式库缓存用ID【包名：文件列表】

        let csslib = csslibify(pkg, name, libid);
        !csslib._imported.length && cssfiles.forEach( cssfile => csslib.imp(cssfile) );     // 未曾导入时，做导入

		return csslib;
    }

}());

function getNodeModulePath(npmpkg){
    bus.at('自动安装', npmpkg);

	let node_modules = [...require('find-node-modules')({ cwd: process.cwd(), relative: false }), ...require('find-node-modules')({ cwd: __dirname, relative: false })];

    for ( let i=0,modulepath,dir; modulepath=node_modules[i++]; ) {
        dir = File.resolve(modulepath, npmpkg);
        if ( File.existsDir(dir) ) {
            return dir;
        }
    }

    // 要么安装失败，或又被删除，总之不应该找不到安装位置
    throw new Error('path not found of npm package: ' + npmpkg);
}

