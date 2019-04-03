const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( OPTS.TypeCodeBlock, (node, object) => {
            if ( isBlankOrComment(object.value) ) {
                node.remove();                          // 删除空白节点和注释节点
            }
        });

    });

}());

function isBlankOrComment(code){
    code = code.trim();
    if ( !code ) return true;                                               // 空白

    if ( /^\/\/.*$/.test(code) && code.indexOf('\n') < 0 ) return true;     // 单行注释

    if ( !code.startsWith('/*') || !code.endsWith('*/') ) {
        return false;                                                       // 肯定不是多行注释
    }

    if ( code.indexOf('*/') === (code.length-2) ) {
        return true;                                                        // 中间没有【*/】，是多行注释
    }

    return false;
}