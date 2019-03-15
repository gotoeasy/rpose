const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');
const npm = require('@gotoeasy/npm');
const hash = require('@gotoeasy/hash');
const findNodeModules = require('find-node-modules');

bus.on('标签全名', function(){

    return file => {

        if ( file.endsWith('```.rpose') ) {
            return '$BuildIn$_' + hash(File.name(file));  // 内置的【```.rpose】特殊处理
        }

        let tagpkg = '';
        let idx = file.lastIndexOf('/node_modules/');
        if ( idx > 0 ) {
            let ary = file.substring(idx + 14).split('/');                          // xxx/node_modules/@aaa/bbb/xxxxxx => [@aaa, bbb, xxxxxx]
            if ( ary[0].startsWith('@') ) {
                tagpkg = ary[0] + '/' + ary[1] + ':' + File.name(file);             // xxx/node_modules/@aaa/bbb/xxxxxx/abc.rpose => @aaa/bbb:abc
            }else{
                tagpkg = ary[0] + ':' + File.name(file);                            // xxx/node_modules/aaa/xxxxxx/abc.rpose => aaa:abc
            }
        }else{
            tagpkg = File.name(file);                                               // aaa/bbb/xxxxxx/abc.rpose => abc
        }

        return tagpkg;
    };

}());

bus.on('标签源文件', function(){

    return (tag, pkg) => {
        if ( tag.endsWith('.rpose') ) {
            return tag; // 已经是文件
        }
        
        if ( tag.indexOf(':') > 0 ) {
            // @taglib指定的标签
            let ary = tag.split(':');
            let oPkg = bus.at('模块组件信息', ary[0]);  //  TODO 配置文件
            let files = oPkg.files;
            let name = '/' + ary[1] + '.rpose';
            for ( let i=0,file; file=files[i++]; ) {
                if ( file.endsWith(name) ) {
                    return file;
                }
            }

        }else{
            let files = bus.at('源文件清单');
            let name = '/' + tag + '.rpose';
            for ( let i=0,file; file=files[i++]; ) {
                if ( file.endsWith(name) ) {
                    return file;
                }
            }
        }
    };

}());


bus.on('文件所在项目配置文件', function(){

    return file => {

        let btfFile, idx = file.lastIndexOf('/node_modules/');
        if ( idx > 0 ) {
            let rs = [];
            rs.push(file.substring(0, idx + 13))                        // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules
            let ary = file.substring(idx + 14).split('/');                     
            if ( ary[0].startsWith('@') ) {
                rs.push(ary[0]);                                        // xxx/node_modules/@aaa/bbb/xxxxxx => @aaa
                rs.push(ary[1]);                                        // xxx/node_modules/@aaa/bbb/xxxxxx => bbb
            }else{
                rs.push(ary[0]);                                        // xxx/node_modules/aaa/bbb/xxxxxx => aaa
            }
            rs.push('rpose.config.btf');

            btfFile = rs.join('/');                                    // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules/@aaa/bbb/rpose.config.btf
        }else{
            let env = bus.at('编译环境');
            btfFile = env.path.root + '/rpose.config.btf';
        }

        if ( File.existsFile(btfFile) ) {
            return btfFile;
        }
        // 不存在时返回undefined
    };

}());


bus.on('模块组件信息', function(map=new Map){

    return function getImportInfo(pkgname){
        pkgname.indexOf(':') > 0 && (pkgname = pkgname.substring(0, pkgname.indexOf(':')));             // @scope/pkg@x.y.z:component => @scope/pkg@x.y.z
        pkgname.lastIndexOf('@') > 0 && (pkgname = pkgname.substring(0, pkgname.lastIndexOf('@')));     // @scope/pkg@x.y.z => @scope/pkg
        pkgname = pkgname.toLowerCase();

        if ( !map.has(pkgname) ) {
            let env = bus.at('编译环境');
        	let nodemodules = [...findNodeModules({ cwd: env.path.root, relative: false }), ...findNodeModules({ cwd: __dirname, relative: false })];
            for ( let i=0,module,path; module=nodemodules[i++]; ) {
                path = File.resolve(module, pkgname).replace(/\\/g, '/');
                if ( File.existsDir(path) ) {
                    let obj = JSON.parse(File.read(File.resolve(path, 'package.json')));
                    let version = obj.version;
                    let name = obj.name;
                    let pkg = name + '@' + version;
                    let files = File.files(path, '/src/**.rpose');
                    let config = File.resolve(path, 'rpose.config.btf');
                    map.set(name, {path, pkg, name, version, files, config});
                    break;
                }
            }
        }

        return map.get(pkgname) || {};
    }

}());

bus.on('组件类名', function(){

    return file => {
        let tagpkg = bus.at('标签全名', bus.at('标签源文件', file));                                             // xxx/node_modules/@aaa/bbb/ui-abc.rpose => @aaa/bbb:ui-abc
        tagpkg = tagpkg.replace(/[@\/]/g, '$').replace(/\./g, '_').replace(':', '$-');                          // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc
        tagpkg = ('-'+tagpkg).split('-').map( s => s.substring(0,1).toUpperCase()+s.substring(1) ).join('');    // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc => $aaa$bbb$UiAbc
        return tagpkg;
    };

}());


bus.on('组件目标文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        if ( srcFile.startsWith(env.path.src_buildin) ) {
            return '$buildin/' + File.name(srcFile);  // buildin
        }

        let tagpkg = bus.at('标签全名', srcFile);   // @aaa/bbb:ui-btn
        return tagpkg.replace(':', '/');
    };

}());


bus.on('页面目标JS文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.js'; 
    };

}());

bus.on('页面目标CSS文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.css'; 
    };

}());

bus.on('页面目标HTML文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.html'; 
    };

}());

bus.on('自动安装', function(rs={}){
    
    return function autoinstall(pkg){

        pkg.indexOf(':') > 0 && (pkg = pkg.substring(0, pkg.indexOf(':')));             // @scope/pkg:component => @scope/pkg
        pkg.lastIndexOf('@') > 0 && (pkg = pkg.substring(0, pkg.lastIndexOf('@')));     // 不该考虑版本，保险起见修理一下，@scope/pkg@x.y.z => @scope/pkg

        if ( !rs[pkg] ) {
            !npm.isInstalled(pkg) && npm.install(pkg);
            rs[pkg] = true;
        }

    }

}());

