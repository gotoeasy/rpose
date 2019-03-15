const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 针对img标签做特殊处理
    //   -- 复制图片资源并哈希化
    //   -- 图片路径加上替换用模板，便于不同目录页面使用时替换为正确的相对目录
    //   -- 上下文中保存是否包含img标签的标记，便于判断是否需替换目录
    return postobject.plugin(__filename, function(root, context){

        root.walk( 'Tag', (node, object) => {

            if ( !/^img$/i.test(object.value) ) return;
            context.result.hasImg = true;

            // TODO 复制文件

            // TODO 哈希化资源名

        }, {readonly:true});

    });

}());
