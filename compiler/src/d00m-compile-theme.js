const Err = require('@gotoeasy/err');
const bus = require('@gotoeasy/bus');
const Btf = require('@gotoeasy/btf');
const File = require('@gotoeasy/file');
const findNodeModules = require('find-node-modules');

bus.on('样式风格', function(result){

    return function(){
        let env = bus.at('编译环境');
        try{
            let map;
            if ( !result ) {
                if ( env.theme ) {
                    let file = getThemeBtfFile();       // 找出配置的风格文件或模块对应的文件
                    map = getThemeMapByFile(file);      // 解析成Map
                }else{
                    map = new Map();                    // 没配置
                }

                result = {
                    less: getThemeLess(map),
                    scss: getThemeScss(map),
                    css: getThemeCss(map)
                };
            }

            return result;

        }catch(e){
            throw Err.cat('init theme failed: '+ env.theme, e);
        }
    };

}());

function getThemeLess(map) {
    let rs = [];
    map.forEach((v,k) => rs.push('@' + k + ' : ' + v + ';'));
    return rs.join('\n')+'\n';
}
function getThemeScss(map) {
    let rs = [];
    map.forEach((v,k) => rs.push('$' + k + ' : ' + v + ';'));
    return rs.join('\n')+'\n';
}
function getThemeCss(map) {
    if ( !map.size ) return '';

    let rs = [];
    rs.push(':root{');
    map.forEach((v,k) => rs.push('--' + k + ' : ' + v + ';'));
    rs.push('}');
    return rs.join('\n')+'\n';
}

function getThemeBtfFile() {
    let env = bus.at('编译环境');
    let file;
    if ( env.theme.endsWith('.btf') ) {
        if ( File.exists(file) ) {
            return file;                                // 绝对路径形式配置
        }

        file = File.resolve(env.path.root, env.theme);    // 工程根目录相对路径形式配置
        if ( File.exists(file) ) {
            return file;
        }

        throw new Err('theme file not found: '+ file);
    }

    // 包名形式配置
    return getThemeBtfFileByPkg(env.theme);
}

function getThemeBtfFileByPkg(themePkg) {
    let ary = [ ...findNodeModules({ cwd: __dirname, relative: false }), ...findNodeModules({ relative: false })];
    for ( let i=0,path,file; path=ary[i++]; ) {
        file = path.replace(/\\/g, '/') + '/' + themePkg + '/theme.btf';
        if ( File.exists(file) ) {
            return file;
        }
    }
    throw new Err('theme file not found: ' + themePkg + '/theme.btf');
}

const fileSet = new Set(); // 循环继承检查用
function getThemeMapByFile(file) {
    if ( fileSet.has(file) ) {
        let ary = [...fileSet].push(file);
        throw Err.cat(ary, new Err('theme circular extend'));
    }
    fileSet.add(file);

    let btf = new Btf(file);
    let superPkg = (btf.getText('extend') || '').trim();                    // 继承的模块名
    let superTheme;
    let theme = btf.getMap('theme');

    if ( superPkg ) {
        superTheme = getThemeMapByFile( getThemeBtfFileByPkg(superPkg) );
        theme.forEach((v,k)=>superTheme.set(k,v));                            // 覆盖父类风格
        theme = superTheme;
    }
    return theme;
}



