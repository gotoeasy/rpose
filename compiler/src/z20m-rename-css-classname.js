const Err = require('@gotoeasy/err');
const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');

const MODULE = '[' + __filename.substring(__filename.replace(/\\/g, '/').lastIndexOf('/')+1, __filename.length-3) + '] ';

bus.on('哈希样式类名', function(){
    
    return function renameCssClassName(srcFile, clsName){

        let name = clsName;

        // 特殊名称不哈希（已哈希的也是下划线开头）
        if ( name.startsWith('_') ) {
            return name;
        }

        const env = bus.at('编译环境');
        if ( clsName.indexOf('@') > 0 ) {
            let ary = clsName.split('@');
            name = `${ary[1]}---${ary[0]}`;             // 引用样式库时，使用命名空间前缀，如 pkgname---the-class
        }else{
            if ( name.indexOf('---') > 0 || name.indexOf('___') > 0 || name.startsWith('_') ) {
                // 已经改过名
            }else{
                let tag = bus.at('标签全名', srcFile);
                name = `${clsName}___${hash(tag)}`;     // 当前项目组件时，标签全名哈希作为后缀，如 my-class___xxxxx
            }
        }

        // 非release模式时不哈希
        if ( !env.release ) return name;

        return '_' + hash(name.toLowerCase());          // 名称已有命名空间前缀，转换为小写后哈希便于复用
    }

}());

