const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const csjs = require('@gotoeasy/csjs');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let style = context.style;

        root.walk( 'RposeBlock', (node, object) => {

            // 编译结果追加到context中以便于读取，节点相应删除
            if ( /^scss$/.test(object.name.value) ) {
                let scss = object.text ? object.text.value : '';
                if ( scss ) {
                    let theme = bus.at('样式风格');
                    style.scss = scssToCss(theme.scss + scss);
                }                

                node.remove();
                return false;
            }
        });

    });

}());


function scssToCss(scss){
    let env = bus.at('编译环境');
    let oCache = bus.at('缓存');
    let catchKey = JSON.stringify(['scssToCss', scss]);
    if ( !env.nocache ) {
        let catchValue = oCache.get(catchKey);
        if ( catchValue ) return catchValue;
    }

    let css = csjs.scssToCss(scss);
    return oCache.set(catchKey, css);
}