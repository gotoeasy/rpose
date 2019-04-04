const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');

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

        let env = bus.at('编译环境');
        let oCache = bus.at('缓存');
        let fromPath = File.path(context.input.file);
        let toPath = oCache.path + '/resources';                                            // 统一目录，假定组件样式及资源都编译到 %缓存目录%/resources
        let assetsPath = '.';                                                               // 样式及资源在同一目录 %缓存目录%/resources
        style.css = bus.at('样式统一化整理', style.css, fromPath, toPath, assetsPath);
    });

}());

