const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // allreferences排序存放页面使用的全部组件的标签全名，便于生成页面js
    return postobject.plugin(/**/__filename/**/, function(root, context){
        if ( !context.result.isPage ) return false;         // 仅针对页面

        let oSetAllTag = new Set();
        context.result.standardtags.forEach(tag => oSetAllTag.add(tag));

        let references = context.result.references;
        references.forEach(tagpkg => {
            let srcFile = bus.at('标签源文件', tagpkg);
            let ctx = bus.at('组件编译缓存', srcFile);
            !ctx && (ctx = bus.at('编译组件', srcFile));
            let standardtags = ctx.result.standardtags;
            standardtags.forEach(tag => oSetAllTag.add(tag));
        });

        // 排序便于生成统一代码顺序
        let allstandardtags = [...oSetAllTag];
        allstandardtags.sort();

        context.result.allstandardtags = allstandardtags;
    });

}());
