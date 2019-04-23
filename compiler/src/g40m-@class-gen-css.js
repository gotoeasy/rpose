const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const hash = require('@gotoeasy/hash');
const Err = require('@gotoeasy/err');

bus.on('创建@class样式', function(){

    // @class="color-red width-100px height--calc(100%_-_50px) box-sizing--border-box padding-5px_10px"
    return (classname, atclass, file) => {
        let css = [], oSetValues = new Set(atclass.trim().toLowerCase().split(/\s+/));
        oSetValues.forEach(v => css.push(bus.at('原子样式', v, file)) );
        return `.${classname}{ ${css.join(' ')} }`;
    };

}());


bus.on('原子样式', function(){

    return (atomcss, file) => {

        // 按最后一个双减号或单减号分割为键值数组
        let kv = splitAtomicKeyValue(atomcss);                              // color-red => ['color', 'red'], align-items--flex-end => ['align-items', 'flex-end']
        if ( !kv ){
            console.warn(`invalid @class value (${atomcss}) in file (${file})`);
            return '';
        }

        // 自定义样式属性名缩写
        let map = new Map();
        map.set('bg', 'background');
        map.set('bgcolor', 'background-color');
        map.has(kv[0]) && (kv[0] = map.get(kv[0]));                         // 输入的是缩写时，替换为全名输出

        return `${kv[0]}:${kv[1]};`;
    };

}());

// 按最后一个双减号或单减号分割为键值数组
function splitAtomicKeyValue(atomcss){
    let key, value;

    // 优先按'--'分割
    let idx = atomcss.lastIndexOf('--');
    if ( idx > 0 ) {
        key = atomcss.substring(0, idx);
        value = atomcss.substring(idx + 2).replace(/_/g, ' ');              // 下划线按空格处理
        return [key, value];
    }

    // 默认按'-'分割
    idx = atomcss.lastIndexOf('-');
    if ( idx > 0 ) {
        key = atomcss.substring(0, idx);
        value = atomcss.substring(idx + 1).replace(/_/g, ' ');              // 下划线按空格处理
        return [key, value];
    }
    return null;
}
