const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        context.project = bus.at('项目配置处理', context.input.file);
    });

}());


bus.on('项目配置处理', function(result={}){

    return function(srcFile){
        let time, stime = new Date().getTime();
        let btfFile = srcFile.endsWith('/rpose.config.btf') ? srcFile : bus.at('文件所在项目配置文件', srcFile);


        if ( result[btfFile] ) return result[btfFile];
        if ( !File.existsFile(btfFile) ) return {};

        let plugins = bus.on('项目配置处理插件');
        let rs = postobject(plugins).process({file: btfFile});

        result[btfFile] = rs.result;

        time = new Date().getTime() - stime;
        time > 100 && console.debug('init-project-config:', time + 'ms');
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
        let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? (cls+ '@' + pkg) : cls );  // 自定义改名函数
        let opts = {rename};

        let oKv;
        root.walk( 'csslib', (node, object) => {
            oKv = bus.at('解析[csslib]', object.value, context, object.loc);
            node.remove();
        });
        if ( !oKv ) return;

        let oCsslib = context.result.oCsslib = {};
        let oCsslibPkgs = context.result.oCsslibPkgs = context.result.oCsslibPkgs || {};
        for ( let k in oKv ) {
            oCsslib[k] = bus.at('样式库', `${k}=${oKv[k]}`);
            oCsslibPkgs[k] = oCsslib[k].pkg;            // 保存样式库{匿名：实际名}的关系，便于通过匿名找到实际包名
        }

    });
}());


// 添加内置标签库
bus.on('项目配置处理插件', function(addBuildinTaglib){
    return postobject.plugin('process-project-config-103', function(root, context){

        if ( !addBuildinTaglib ) {
            let pkg = '@rpose/buildin';
            if ( !bus.at('自动安装', pkg) ) {
                throw new Error('package install failed: ' + pkg);
            }
            bus.at('标签库定义', '@rpose/buildin:```', '');  // 项目范围添加内置标签库
            bus.at('标签库定义', '@rpose/buildin:router', '');  // 项目范围添加内置标签库
            bus.at('标签库定义', '@rpose/buildin:router-link', '');  // 项目范围添加内置标签库
            addBuildinTaglib = true;
        }

    });

}());


// 建立项目标签库
bus.on('项目配置处理插件', function(addBuildinTaglib){
    return postobject.plugin('process-project-config-105', function(root, context){

        let oKv, startLine;
        root.walk( 'taglib', (node, object) => {
            oKv = bus.at('解析[taglib]', object.value, context, object.loc);
            startLine = object.loc.start.line;
            node.remove();
        });
        
        context.result.oTaglib = oKv || {}; // 存键值，用于检查重复
        if ( !oKv ) return;

        // 检查安装依赖包
        let mapPkg = new Map();
        for ( let key in oKv ) {
            mapPkg.set(oKv[key].pkg, oKv[key]);
        }
        mapPkg.forEach((oTag, pkg) => {
            if ( !bus.at('自动安装', pkg) ) {
                throw new Err('package install failed: ' + pkg, { file: context.input.file, text: context.input.text, line: startLine + oTag.line, column: 1 });
            }
        });

        // 逐个定义标签库关联实际文件
        for ( let key in oKv ) {
            try{
                bus.at('标签库定义', oKv[key].taglib, context.input.file);  // 无法关联时抛出异常
            }catch(e){
                throw new Err.cat(e, { file: context.input.file, text: context.input.text, line: startLine + oKv[key].line, column: 1 });
            }
        }

        // 添加内置标签库
        if ( !addBuildinTaglib ) {
            pkg = '@rpose/buildin';
            if ( !bus.at('自动安装', pkg) ) {
                throw new Error('package install failed: ' + pkg);
            }
            bus.at('标签库定义', '@rpose/buildin:```', '');  // 项目范围添加内置标签库
            bus.at('标签库定义', '@rpose/buildin:router', '');  // 项目范围添加内置标签库
            bus.at('标签库定义', '@rpose/buildin:router-link', '');  // 项目范围添加内置标签库
            addBuildinTaglib = true;
        }


    });

}());
