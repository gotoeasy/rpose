const bus = require('@gotoeasy/bus');

bus.on('解析原子样式', function(atomcss, file) {

    // 按冒号分隔伪类选择器
    // 按首双减号或末单减号分割为键值数组
    // 
    // hover:color-red => {pseudo: 'hover', key: 'color', value: 'red'}
    // color-red => {pseudo: undefined, key: 'color', value: 'red'}
    // align-items--flex-end =>  {pseudo: undefined, key: 'align-items', value: 'flex-end'}
    // 
    let oAtClass = splitAtomicKeyValue(atomcss);
    if ( !oAtClass ){
        console.warn(`invalid @class value (${atomcss}) in file (${file})`);
        return null;
    }

    // 自定义样式属性名缩写
    let map = new Map();
    map.set('bg', 'background');
    map.set('bgcolor', 'background-color');
    map.has(oAtClass.key) && (oAtClass.key = map.get(oAtClass.key));        // 键名使用缩写时，替换为全名

    return oAtClass;
});

// 按首双减号或末单减号分割为键值数组
function splitAtomicKeyValue(atomcss){
    let pseudo, key, value;

    // 优先判断是否有伪类选择器
    let idx = atomcss.indexOf(':');
    if ( idx > 0 ) {
        pseudo = atomcss.substring(0, idx);                                 // 伪类用冒号分隔
        atomcss = atomcss.substring(idx + 1);
    }

    // 优先按首双减号'--'分割
    idx = atomcss.indexOf('--');
    if ( idx > 0 ) {
        key = atomcss.substring(0, idx);
        value = atomcss.substring(idx + 2).replace(/_/g, ' ');              // 下划线按空格处理
        return {pseudo, key, value};
    }

    // 默认按末单减号'-'分割
    idx = atomcss.lastIndexOf('-');
    if ( idx > 0 ) {
        key = atomcss.substring(0, idx);
        value = atomcss.substring(idx + 1).replace(/_/g, ' ');              // 下划线按空格处理
        return {pseudo, key, value};
    }
    return null;
}
