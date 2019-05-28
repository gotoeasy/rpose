const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');

bus.on('项目配置处理', function(result={}){

    return function(srcFile, nocahce=false){

        let time, stime = new Date().getTime();
        let btfFile = srcFile.endsWith('/rpose.config.btf') ? srcFile : bus.at('文件所在项目配置文件', srcFile);

        nocahce && (delete result[btfFile]);

        // 使用缓存
        if ( result[btfFile] ) return result[btfFile];

        // 没有配置文件时，返回默认配置信息
        if ( !File.existsFile(btfFile) ){
            let path = {};
            let root = File.path(btfFile);
            path.src = root + '/src';
            path.build = root + '/' + path.build;
            path.build_temp = path.build + '/temp';
            path.build_dist = path.build + '/dist';
            path.build_dist_images = 'images';
            path.svgicons = root + '/resources/svgicons';

            let result = {oTaglibs: {}, oCsslibs: {}, oCsslibPkgs: {}, oSvgicons: {}};
            return {path, result};
        }

        // 开始解析配置文件
        let plugins = bus.on('项目配置处理插件');
        let context = postobject(plugins).process({file: btfFile});

        result[btfFile] = context;

        // 当前项目配置文件时，安装、检查[taglib]配置
        let env = bus.at('编译环境');
        if ( env.config === btfFile ) {
            let oTaglibs = context.result.oTaglibs;
            for ( let alias in oTaglibs ) {
                let taglib = oTaglibs[alias];
                if ( !bus.at('自动安装', taglib.pkg) ) {
                    throw new Err('package install failed: ' + taglib.pkg, { file: context.input.file, text: context.input.text, start: taglib.pos.start, end: taglib.pos.end });
                }

                try{
                    bus.at('标签库源文件', taglib);
                }catch(e){
                    throw new Err(e.message, e, { file: context.input.file, text: context.input.text, start: taglib.pos.start, end: taglib.pos.end });
                }
            }
        }

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
            let pos = object.text.pos
            let oNode = this.createNode({type, value, pos});
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

        context.path = oPath;
    });

}());



// 建立项目样式库
bus.on('项目配置处理插件', function(){
    return postobject.plugin('process-project-config-110', function(root, context){

        let csslibs;                                                                        // 保存[csslib]解析结果
        root.walk( 'csslib', (node, object) => {
            csslibs = bus.at('解析[csslib]', object, context.input.file, context.input.text);
            node.remove();
        });

        let oCsslibs = context.result.oCsslibs = {};
        let oCsslibPkgs = context.result.oCsslibPkgs = {};

        if ( csslibs ) {
            let oCsslib;
            for ( let alias in csslibs ) {
                oCsslib = bus.at('样式库', csslibs[alias], context.input.file);             // 转换为样式库对象
                if ( oCsslib.isEmpty ) {
                    throw new Err('css file not found', { file: context.input.file, text: context.input.text, start: csslibs[alias].pos.start, end: csslibs[alias].pos.end });
                }

                oCsslibs[alias] = oCsslib;                                                  // 存放样式库对象
                oCsslibPkgs[alias] = oCsslib.pkg;                                           // 存放样式库【别名-包名】映射关系（包名不一定是csslib.pkg）
            }
        }

    });
}());


// 默认安装内置包
bus.on('项目配置处理插件', function(install){

    return postobject.plugin('process-project-config-120', function(){
        if ( !install ) {
            bus.at('自动安装', '@rpose/buildin');
        }
    });

}());


// 建立项目标签库
bus.on('项目配置处理插件', function(){

    return postobject.plugin('process-project-config-130', function(root, context){

        let oTaglibs;
        root.walk( 'taglib', (node, object) => {
            oTaglibs = bus.at('解析[taglib]', object, context.input.file);      // 含格式检查、别名重复检查
            node.remove();
        });

        context.result.oTaglibs = oTaglibs || {};                               // 保存[taglib]解析结果
    });

}());

// 保存引入的svg图标
bus.on('项目配置处理插件', function(){

    return postobject.plugin('process-project-config-140', function(root, context){

        let oSvgicons;
        root.walk( 'svgicon', (node, object) => {
            oSvgicons = bus.at('解析[svgicon]', object, context);                // 含格式检查、别名重复检查
            node.remove();
        });

        context.result.oSvgicons = oSvgicons || {};                              // 保存[svgicon]解析结果
    });

}());
