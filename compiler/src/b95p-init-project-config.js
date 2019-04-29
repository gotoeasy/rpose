const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        context.project = bus.at('项目配置处理', context.input.file);
    });

}());


bus.on('项目配置处理', function(result={}, oDefaultResult){

    return function(srcFile, nocahce=false){
        nocahce && (result = {});
        let time, stime = new Date().getTime();
        let btfFile = srcFile.endsWith('/rpose.config.btf') ? srcFile : bus.at('文件所在项目配置文件', srcFile);


        if ( result[btfFile] ) return result[btfFile];
        if ( !File.existsFile(btfFile) ){
            // 没有配置文件，仅返回默认路径信息
            if ( !oDefaultResult ) {
                let oPath = {};
                let root = File.path(btfFile);
                oPath.src = root + '/src';
                oPath.build = root + '/' + oPath.build;
                oPath.build_temp = oPath.build + '/temp';
                oPath.build_dist = oPath.build + '/dist';
                oPath.build_dist_images = 'images';
                oPath.svgicons = root + '/resources/svgicons';
                oDefaultResult = {path: oPath};
            }
            return oDefaultResult;
        }

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
        context.input = context.input || {};
        context.result = context.result || {};

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


// 解析[path]块
bus.on('项目配置处理插件', function(){
    
    return postobject.plugin('process-project-config-102', function(root, context){

        let oPath = {};
        oPath.root = File.path(context.input.file);

        root.walk( 'path', (node, object) => {
            let lines = object.value.trim().split('\n');
            lines.forEach(line => {
                let bk = '=', idx1 = line.indexOf('='), idx2 = line.indexOf(':');
                idx2 >= 0 && (idx1 < 0 || idx2 < idx1) && (bk = ':');               // 冒号在前则按冒号分隔
                let v, kv = line.replace(bk, '\n').split('\n').map(s=>s.trim());
                if ( kv.length == 2 && kv[0] ) {
                    v = kv[1].split('//')[0].trim();                                // 去注释
                    oPath[kv[0]] = v;
                }
            });
        }, {readonly: true});

        oPath.src = oPath.root + '/src';
        oPath.build = oPath.build ? (oPath.root + '/' + oPath.build).replace(/\/\//g, '/') : (oPath.root + '/build');
        oPath.build_temp = oPath.build + '/temp';
        oPath.build_dist = oPath.build + '/dist';
        !oPath.build_dist_images && (oPath.build_dist_images = 'images');
//        oPath.cache = oPath.cache;
        oPath.svgicons = oPath.root + '/' + (oPath.svgicons || 'resources/svgicons');      // SVG图标文件目录

        context.result.path = oPath;
    });

}());



// 建立项目样式库
bus.on('项目配置处理插件', function(){
    return postobject.plugin('process-project-config-110', function(root, context){

        let oKv;
        root.walk( 'csslib', (node, object) => {
            oKv = bus.at('解析[csslib]', object.value, context, object.loc);
            node.remove();
        });
        if ( !oKv ) return;

        let oCsslib = context.result.oCsslib = {};
        let oCsslibPkgs = context.result.oCsslibPkgs = context.result.oCsslibPkgs || {};

        for ( let k in oKv ) {
            oCsslib[k] = bus.at('样式库', `${k}=${oKv[k]}`, context);
            oCsslibPkgs[k] = oCsslib[k].pkg;            // 保存样式库{匿名：实际名}的关系，便于通过匿名找到实际包名
        }

    });
}());


// 添加内置标签库
bus.on('项目配置处理插件', function(addBuildinTaglib){
    return postobject.plugin('process-project-config-120', function(){

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
    return postobject.plugin('process-project-config-130', function(root, context){

        let oKv, startLine;
        root.walk( 'taglib', (node, object) => {
            oKv = bus.at('解析[taglib]', object.value, context, object.loc);
            startLine = object.loc.start.line + 1;
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
                throw new Err('package install failed: ' + pkg, { file: context.input.file, text: context.input.text, line: startLine + oTag.line });
            }
        });

        // 逐个定义标签库关联实际文件
        for ( let key in oKv ) {
            try{
                bus.at('标签库定义', oKv[key].taglib, context.input.file);  // 无法关联时抛出异常
            }catch(e){
                throw new Err.cat(e, { file: context.input.file, text: context.input.text, line: startLine + oKv[key].line });
            }
        }

        // 添加内置标签库
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
