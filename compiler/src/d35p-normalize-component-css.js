const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // ----------------------------------------------------------------------
    // 全部资源文件统一复制到 %缓存目录%/resources 中，并哈希化
    // 用以避免clean命令删除build目录导致资源文件丢失
    // 组件样式统一编译到同一目录，即url中没有目录，简化后续页面资源目录调整
    // ----------------------------------------------------------------------
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let style = context.style;

        // 解决样式中URL资源的复制及改名问题
        root.walk( 'RposeBlock', (node, object) => {

            // 编译结果追加到context中以便于读取，节点相应删除
            if ( /^css$/.test(object.name.value) ) {
                let css = object.text ? object.text.value : '';
                if ( css ) {
                    let theme = bus.at('样式风格');
                    style.css = theme.css + css;
                }                

                node.remove();
                return false;
            }
        });

        if ( !style.css ) return;

        let from = context.input.file.replace(/\.rpose$/i, '.css'); 
        style.css = bus.at('样式统一化整理', style.css, from);
    });

}());

