const Err = require('@gotoeasy/err');
const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');


bus.on('编译模块组件', function(){

	return function(pkgname){

        pkgname.lastIndexOf(':') > 0 && (pkgname = pkgname.substring(0, pkgname.lastIndexOf(':'))); // pkg:abc-def => pkg
        pkgname.lastIndexOf('@') > 0 && (pkgname = pkgname.substring(0, pkgname.lastIndexOf('@'))); // @scope/pkg@x.y.z => @scope/pkg

        let oPkg = bus.at('模块组件信息', pkgname);
        let files = oPkg.files || [];
        for ( let i=0,file; file=files[i++]; ) {
            bus.at('编译组件', file);
        }

	};


}());

bus.on('模块组件信息', function(map=new Map){

    return function getImportInfo(pkgname){
        pkgname.indexOf(':') > 0 && (pkgname = pkgname.substring(0, pkgname.indexOf(':')));             // @scope/pkg@x.y.z:component => @scope/pkg@x.y.z
        pkgname.lastIndexOf('@') > 0 && (pkgname = pkgname.substring(0, pkgname.lastIndexOf('@')));     // @scope/pkg@x.y.z => @scope/pkg
        pkgname = pkgname.toLowerCase();

        if ( !map.has(pkgname) ) {
        	let nodemodules = [...require('find-node-modules')({ cwd: process.cwd(), relative: false }), ...require('find-node-modules')({ cwd: __dirname, relative: false })];
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
