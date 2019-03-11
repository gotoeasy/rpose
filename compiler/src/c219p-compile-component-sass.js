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
            if ( /^sass$/.test(object.name.value) ) {
                let sass = object.text ? object.text.value : '';
                if ( sass ) {
                    let theme = bus.at('样式风格');
                    style.sass = sassToCss(theme.sass + sass);
                }                

                node.remove();
                return false;
            }
        });

    });

}());


function sassToCss(sass){
    let hashcode = hash(sass);
    let cachefile = `${bus.at('缓存目录')}/sass-to-css/${hashcode}.css`;
    if ( File.existsFile(cachefile) ) return File.read(cachefile);

    let css = csjs.sassToCss(sass);
    File.write(cachefile, css);
    return css;
}