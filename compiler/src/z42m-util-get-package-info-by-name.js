const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');
const findNodeModules = require('find-node-modules');

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

        return map.get(pkgname) || {files:[],config:''};
    }

}());
