const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){
        context.project = bus.at('项目配置处理', context.input.file);
    });

}());


bus.on('项目配置处理', function(result={}){

    return function(srcFile){
        let btfFile = srcFile.endsWith('/rpose.config.btf') ? srcFile : bus.at('文件所在项目配置文件', srcFile);


        if ( !File.existsFile(btfFile) ) return {};
        if ( result[btfFile] ) return result[btfFile];

        let plugins = bus.on('项目配置处理插件');
        let rs = postobject(plugins).process({file: btfFile});

        result[btfFile] = rs.result;
        return result[btfFile];
    };

}());



// 解析项目的btf配置文件, 构建语法树
bus.on('项目配置处理插件', function(){
    
    return postobject.plugin('process-project-config-101', function(root, context){
        context.input = {};
        context.result = {};

        root.walk( (node, object) => {
            context.input.file = object.file;
            context.input.text = File.read(object.file);

            let blocks = bus.at('项目配置文件解析', context.input.text );
            let newNode = this.createNode(blocks);  // 转换为树节点并替换
            node.replaceWith(...newNode.nodes);     // 一个Block一个节点
        });

        // 简化，节点类型就是块名，节点value就是内容，没内容的块都删掉
        root.walk( (node, object) => {
            if ( !object.text || !object.text.value || !object.text.value.trim() ) return node.remove();
 
            let type = object.name.value;
            let value = object.text.value;
            let loc = object.text.loc;
            let oNode = this.createNode({type, value, loc});
            node.replaceWith(oNode);
        });

    });

}());


// 建立项目样式库
bus.on('项目配置处理插件', function(){
    return postobject.plugin('process-project-config-102', function(root, context){

        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (lib, cls) => hashClassName(context.input.file, lib ? (cls+ '@' + lib) : cls );  // 自定义改名函数
        let opts = {rename};

        let oKv;
        root.walk( 'csslib', (node, object) => {
            oKv = bus.at('解析[csslib]', object.value, context, object.loc);
            node.remove();
        });
        if ( !oKv ) return;

        let oCsslib = context.result.oCsslib = {};
        for ( let k in oKv ) {
            oCsslib[k] = bus.at('样式库', k, oKv[k]);
        }

    });
}());


// 建立项目标签库
bus.on('项目配置处理插件', function(){
    return postobject.plugin('process-project-config-103', function(root, context){

        let oKv;
        root.walk( 'taglib', (node, object) => {
            oKv = bus.at('解析[taglib]', object.value, context, object.loc);
            node.remove();
        });
        
        context.result.oTaglib = oKv || {}; // 存键值，用于检查重复
        if ( !oKv ) return;

        for ( let k in oKv ) {
            bus.at('标签库定义', `${k}=${oKv[k]}`, context.input.file); 
        }
    });
}());


