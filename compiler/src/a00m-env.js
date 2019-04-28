const File = require('@gotoeasy/file');
const Btf = require('@gotoeasy/btf');
const bus = require('@gotoeasy/bus');
const util = require('@gotoeasy/util');
const Err = require('@gotoeasy/err');
const npm = require('@gotoeasy/npm');
const path = require('path');

// 从根目录的rpose.config.btf读取路径文件配置
// 读不到则使用默认配置
bus.on('编译环境', function(result){

    return function(opts, nocache=false){
        nocache && (result = null);
        if ( result ) return result;

        let packagefile = File.resolve(__dirname, './package.json');
        !File.existsFile(packagefile) && (packagefile = File.resolve(__dirname, '../package.json'));
        let compilerVersion = JSON.parse(File.read(packagefile)).version;
        let defaultFile = File.path(packagefile) + '/default.rpose.config.btf';

        result = parseRposeConfigBtf('rpose.config.btf', defaultFile, opts);   // 相对命令行目录

        result.clean = !!opts.clean;
        result.release = !!opts.release;
        result.debug = !!opts.debug;
        result.nocache = !!opts.nocache;
        result.build = !!opts.build;
        result.watch = !!opts.watch;

        result.compilerVersion = compilerVersion;
        if ( result.path.cache ) {
            result.path.cache = File.resolve(result.path.cwd, result.path.cache);   // 缓存目录
        }

        return result;
    };

}());

function parseRposeConfigBtf(file, defaultFile, opts){
    let cwd = opts.cwd || process.cwd();
    cwd = path.resolve(cwd).replace(/\\/g, '/');
    if ( !File.existsDir(cwd) ) {
        throw new Err('invalid path of cwd: '+ opts.cwd);
    }

    let root = cwd;
    file = File.resolve(root, file);
    if ( !File.exists(file) ) (file = defaultFile);
    
    let result = {path:{}};

    // 项目配置文件
    let btf = new Btf(file);
    let mapPath = btf.getMap('path');
    mapPath.forEach((v,k) => mapPath.set(k, v.split('//')[0].trim()));

    let mapImport = btf.getMap('taglib');
    let imports = {};
    mapImport.forEach( (v,k) => imports[k] = v.split('//')[0].trim() );
    result.imports = imports;

    // 目录
    result.path.cwd = cwd;
    result.path.root = root;
    result.path.src = root + '/src';

    result.path.build = getConfPath(root, mapPath, 'build', 'build');
    result.path.build_temp = result.path.build + '/temp';
    result.path.build_dist = result.path.build + '/dist';
    result.path.build_dist_images = mapPath.get('build_dist_images') || 'images';       // 打包后的图片目录
    result.path.cache = mapPath.get('cache');                                           // 缓存大目录
    result.path.svgicons = mapPath.get('svgicons') || (root + '/resources/svgicons');   // SVG图标文件目录

    result.theme = ((btf.getText('theme') == null || !btf.getText('theme').trim()) ? '@gotoeasy/theme' : btf.getText('theme').trim());
    result.prerender = ((btf.getText('prerender') == null || !btf.getText('prerender').trim()) ? '@gotoeasy/pre-render' : btf.getText('prerender').trim());

    // 自动检查安装依赖包
    autoInstallLocalModules(result.theme, result.prerender);

    return result;
}

function getConfPath(root, map, key, defaultValue){
    // TODO 检查配置目录的合法性
    if ( !map.get(key) ) {
        return root + '/' + defaultValue.split('/').filter(v => !!v).join('/');
    }
    return root + '/' + map.get(key).split('/').filter(v => !!v).join('/');
}

// TODO 提高性能
function autoInstallLocalModules(...names){
    let ignores = ['@gotoeasy/theme', '@gotoeasy/pre-render'];

    let node_modules = [ ...require('find-node-modules')({ cwd: __dirname, relative: false }), ...require('find-node-modules')({ cwd: process.cwd(), relative: false })];

    for ( let i=0,name; name=names[i++]; ) {
        if ( ignores.includes(name) ) continue;

        let isInstalled = false;
        for ( let j=0,dir; dir=node_modules[j++]; ) {
            if ( File.isDirectoryExists( File.resolve(dir, name) ) ) {
                isInstalled = true;
                continue;
            }
        }
        !isInstalled && npm.install(name);
    }

}