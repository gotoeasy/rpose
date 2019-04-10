const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const csjs = require('@gotoeasy/csjs');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let style = context.style;

        root.walk( 'RposeBlock', (node, object) => {

            // 编译结果追加到context中以便于读取，节点相应删除
            if ( /^less$/.test(object.name.value) ) {
                let less = object.text ? object.text.value : '';
                if ( less ) {
                    let theme = bus.at('样式风格');
                    style.less = lessToCss(theme.less + less);
                }                

                node.remove();
                return false;
            }
        });

    });

}());


function lessToCss(less){
    let env = bus.at('编译环境');
    let oCache = bus.at('缓存');
    let cacheKey = JSON.stringify(['lessToCss', less]);
    if ( !env.nocache ) {
        let cacheValue = oCache.get(cacheKey);
        if ( cacheValue ) return cacheValue;
    }

    let css = csjs.lessToCss(less);
    return oCache.set(cacheKey, css);
}