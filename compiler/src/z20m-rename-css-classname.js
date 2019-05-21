const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');

bus.on('哈希样式类名', function(){
    
    // -------------------------------------------------------
    // release模式
    // foo          => _xxxxx
    // foo@pkg      => _xxxxx
    // _xxxxx       => _xxxxx（视为已改名不再修改）
    // 
    // 非release模式
    // foo          => foo___xxxxx
    // foo@pkg      => foo---pkg
    // foo---pkg    => foo---pkg（视为已改名不再修改）
    // foo___xxxxx  => foo___xxxxx（视为已改名不再修改）
    // -------------------------------------------------------
    return function renameCssClassName(srcFile, clsName){

        let name = clsName;

        // 特殊名称不哈希（已哈希的是下划线开头）
        if ( name.startsWith('_') ) {
            return name;
        }


        const env = bus.at('编译环境');
        if ( clsName.indexOf('@') > 0 ) {
            let ary = clsName.split('@');
            !ary[1] && (ary[1] = 'UNKNOW');

            name = `${ary[0]}---${ary[1]}`;                                 // 引用样式库时，使用命名空间后缀，如 the-class---pkgname
        }else{
            if ( name.indexOf('---') > 0 || name.indexOf('___') > 0 ) {
                // 已经改过名
            }else{
                let tag = bus.at('标签全名', srcFile);
                name = `${clsName}___${hash(tag)}`;                         // 当前项目组件时，标签全名哈希作为后缀，如 my-class___xxxxx
            }
        }

        name = name.replace(/[^a-zA-z0-9\-_]/g, '-');                       // 包名中【字母数字横杠下划线】以外的字符都替换为下划线，便于在非release模式下查看
        if ( !env.release ) return name;                                    // 非release模式时不哈希
        return '_' + hash(name);                                            // 名称已有命名空间前缀，转换为小写后哈希便于复用
    }

}());

