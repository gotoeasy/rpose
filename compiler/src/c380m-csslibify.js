const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const csslibify = require('csslibify');

bus.on('样式库', function(rs={}){
    
    return function (name, imports){
        if ( imports == null ) {
            return rs[name];
        }

 //console.info(MODULE, '---csslibify----', name, imports)

        name = name.toLowerCase().trim();
        if ( rs[name] ) return rs[name];    // 已定义过则返回已定义结果（意味着无法重复定义）   // TODO 警告提示

        let idx = imports.indexOf(':');
        let npmpkg = idx > 0 ? imports.substring(0, idx) : imports;
        npmpkg.lastIndexOf('@') > 1 && ( npmpkg = imports.substring(0, npmpkg.lastIndexOf('@')) );
        npmpkg = npmpkg.trim();
        let filters = [];
        let cssfilter = idx > 0 ? imports.substring(idx + 1) : '';
        cssfilter.replace(/;/g, ',').split(',').forEach(ptn => {
            ptn = ptn.trim();
            ptn && filters.push(ptn);
        });
        
        !filters.length && filters.push('**.min.css');      // 默认取npm包下所有压缩后文件*.min.css

        let dir = getNodeModulePath(npmpkg);
        let cssfiles = File.files(dir, ...filters);
        let aryTxt = [];
        cssfiles.forEach( f => aryTxt.push(File.read(f)) );

        let css = aryTxt.join('\n');
        let csslib = csslibify(name);
        csslib.imp(css);
        rs[name] = csslib;
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
    
    return function (pkg, ...classnames){
       let csslib = bus.at('样式库', pkg);
       let ary = [];
       classnames.forEach(cls => ary.push(cls.startsWith('.') ? cls : ('.' + cls)));
       let css = csslib.get( ...ary );
       return css;
    }

}());
