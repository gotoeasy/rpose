const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');

bus.on('创建@class样式', function(){

    // @class="hover:color-red color-red width-100px height--calc(100%_-_50px) box-sizing--border-box padding-5px_10px"
    // 样式类名和样式内容相关，以减少样式类名的变动
    return (atclass, file) => {
        let oAtClass, oPseudo = new Set(), pseudocss = [], normalcss = [], ary = [...new Set(atclass.trim().split(/\s+/))];
        ary.sort();
        ary.forEach(v => {
            oAtClass = bus.at('解析原子样式', v, file);
            if ( oAtClass ) {
                if ( oAtClass.pseudo ) {
                    oPseudo.add(oAtClass.pseudo.toLowerCase());
                    pseudocss.push(`${oAtClass.key}:${oAtClass.value};`);
                }else{
                    normalcss.push(`${oAtClass.key}:${oAtClass.value};`);
                }
            }
        });


        let name = 'atclass-' + hash(atclass);                                  // 样式类名
        let ncss = `.${name}{ ${normalcss.join(' ')} }`;                        // 普通样式
        let pcss = pseudocss.join(' ');
        if ( pcss ) {
            let names = [];
            oPseudo.forEach(pseudo => names.push(`.${name}:${pseudo}`));
            pcss = `${names.join(',')}{ ${pcss} }`;                             // 伪类样式
        }
        
        return {name, css: ncss + '\n' + pcss};
    };

}());
