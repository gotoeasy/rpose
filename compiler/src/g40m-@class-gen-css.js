const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const hash = require('@gotoeasy/hash');
const Err = require('@gotoeasy/err');

bus.on('创建@class样式', function(){

    // @class="color-red width-100px height--calc(100%_-_50px) box-sizing--border-box padding-5px_10px"
    // 样式类名和样式内容相关，以减少样式类名的变动
    return (atclass, file) => {
        let css = [], ary = [...new Set(atclass.trim().toLowerCase().split(/\s+/))];
        ary.sort();
        ary.forEach(v => css.push(bus.at('原子样式', v, file)) );
        css = css.join(' ');
        let name = 'atclass-' + hash(css);
        css = `.${name}{ ${css} }`;
        return {name, css};
    };

}());


bus.on('原子样式', function(){

    return (atomcss, file) => {

        // 按首双减号或末单减号分割为键值数组
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

// 按首双减号或末单减号分割为键值数组
function splitAtomicKeyValue(atomcss){
    let key, value;

    // 优先按首双减号'--'分割
    let idx = atomcss.indexOf('--');
    if ( idx > 0 ) {
        key = atomcss.substring(0, idx);
        value = atomcss.substring(idx + 2).replace(/_/g, ' ');              // 下划线按空格处理
        return [key, value];
    }

    // 默认按末单减号'-'分割
    idx = atomcss.lastIndexOf('-');
    if ( idx > 0 ) {
        key = atomcss.substring(0, idx);
        value = atomcss.substring(idx + 1).replace(/_/g, ' ');              // 下划线按空格处理
        return [key, value];
    }
    return null;
}
