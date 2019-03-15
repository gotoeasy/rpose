const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const csslibify = require('csslibify');

bus.on('样式库', function(rs={}){
    
    // ----------------------------------------------------
    // bus.at('样式库', 'defaultname=pkg:**.min.css')             ...... 建库，库名为defaultname
    // bus.at('样式库', 'thename', 'defaultname=pkg:**.min.css')  ...... 建库，库名为thename
    // bus.at('样式库', 'thename', 'pkg:**.min.css')              ...... 建库，库名为thename
    // bus.at('样式库', 'thename')                                ...... 取名为thename的库
    // 
    // [ defCsslib ] 
    //   *=pkg:**/**.min.js
    //   name=pkg:**/aaa*.min.js, **/bbb*.min.js
    //   name=pkg
    //   pkg:**/**.min.js
    //   pkg
    return function (name='', defCsslib=''){

        let names = name.split('=');
        if ( names.length > 1 && !defCsslib ) {
            // 定义包含库名，直接按定义建库的意思，重新整理参数后继续
            defCsslib = names[1];
            name = names[0].trim();
        }else if ( name.indexOf(':') > 0 ) {
            // 定义不包含库名，直接按定义建库的意思，重新整理参数后继续
            defCsslib = name;
            name = '';
        }

        if ( !defCsslib ) {
            let csslib = rs[name] || csslibify(name);
            csslib.name = name;
            return csslib;                                                                  // 没有定义导入内容，直接返回库对象
        }

        let match;
        let pkg, filters = [];
        if ( (match = defCsslib.match(/^.*?=(.*?):(.*)$/)) ) {
            // name=pkg:filters
            pkg = match[1].trim();
            cssfilter = match[2];
            cssfilter.replace(/;/g, ',').split(',').forEach(filter => {
                filter = filter.trim();
                filter && filters.push(filter);
            });
        }else if ( (match = defCsslib.match(/^.*?=(.*)$/)) ) {
            // name=pkg
            pkg = match[1].trim();
            filters.push('**.min.css');                                                     // 默认取npm包下所有压缩后文件*.min.css
        }else if ( (match = defCsslib.match(/^(.*?):(.*)$/)) ) {
            // pkg:filters
            pkg = match[1].trim();
            cssfilter = match[2];
            cssfilter.replace(/;/g, ',').split(',').forEach(filter => {
                filter = filter.trim();
                filter && filters.push(filter);
            });
        }else{
            // pkg
            pkg = defCsslib.trim();
            filters.push('**.min.css');                                                     // 默认取npm包下所有压缩后文件*.min.css
        }

        // 导入处理
        pkg.lastIndexOf('@') > 1 && ( pkg = pkg.substring(0, pkg.lastIndexOf('@')) );       // 模块包名去除版本号 （通常不该有，保险起见处理下）
        let dir = getNodeModulePath(pkg);                                                   // 模块包安装目录
        let cssfiles = File.files(dir, ...filters);                                         // 待导入的css文件数组

        let csslib = rs[name] || csslibify(name);                                           // 已定义过则按名称取出库，继续导入文件
        cssfiles.forEach( cssfile => csslib.imp(cssfile) );                                 // 逐个文件导入

        name && (rs[name] = csslib);
        csslib.name = name;             // 库名
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

bus.on('样式库引用', function(){
    
    return function (libname, ...classnames){
       let csslib = bus.at('样式库', libname);
       return csslib.get( ...classnames );
    }

}());
