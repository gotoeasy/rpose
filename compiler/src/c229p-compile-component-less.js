const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

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
    let hashcode = hash(less);
    let cachefile = `${bus.at('缓存目录')}/less-to-css/${hashcode}.css`;
    if ( File.existsFile(cachefile) ) return File.read(cachefile);

    let css = csjs.lessToCss(less);
    File.write(cachefile, css);
    return css;
}