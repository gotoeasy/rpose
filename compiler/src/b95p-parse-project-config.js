const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        
        // 解析项目配置文件
        context.project = bus.at('项目配置处理', context.input.file);

    });

}());


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

            let result = {};
            let oDefContext = {path, result};

            processConfigTaglibs(oDefContext);                                              // 项目[taglib]配置中自动补足内置组件配置
            return oDefContext;
        }

        // 开始解析配置文件
        let plugins = bus.on('项目配置处理插件');
        let context = postobject(plugins).process({file: btfFile});

        processConfigTaglibs(context);                                                      // 项目[taglib]配置中自动补足内置组件配置

        // 安装、检查[taglib]配置
        let oTaglibs = context.result.oTaglibs;
        for ( let alias in oTaglibs ) {
            let taglib = oTaglibs[alias];
            if ( !bus.at('自动安装', taglib.pkg) ) {
                throw new Err('package install failed: ' + taglib.pkg, { file: context.input.file, text: context.input.text, start: taglib.pos.start, end: taglib.pos.end });
            }
            if ( !bus.at('标签库源文件', taglib) ) {
                throw new Err('taglib component not found: ' + taglib.tag, { file: context.input.file, text: context.input.text, start: taglib.pos.start, end: taglib.pos.end });
            }
        }

        result[btfFile] = context;

        time = new Date().getTime() - stime;
        time > 100 && console.debug('init-project-config:', time + 'ms');

        return result[btfFile];
    };


    // 项目[taglib]配置中自动补足内置组件配置
    function processConfigTaglibs(context){

        // 项目[taglib]配置
        let oTaglibs = context.result.oTaglibs = context.result.oTaglibs || {};

        // 默认添加内置组件的[taglib]配置
        bus.at('自动安装', '@rpose/buildin');                                         // 默认安装内置包
        let taglib;
        if ( !oTaglibs['router'] ) {
            taglib = bus.at('解析taglib', 'router=@rpose/buildin:router');            // 默认添加内置标签配置
            oTaglibs['router'] = oTaglibs['@router'] = taglib;
        }
        if ( !oTaglibs['router-link'] ) {
            taglib = bus.at('解析taglib', 'router-link=@rpose/buildin:router-link');  // 默认添加内置标签配置
            oTaglibs['router-link'] = oTaglibs['@router-link'] = taglib;
        }
    }


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

        context.path = oPath;
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


// 建立项目标签库
bus.on('项目配置处理插件', function(){

    return postobject.plugin('process-project-config-120', function(root, context){

        let oTaglibs;
        root.walk( 'taglib', (node, object) => {
            oTaglibs = bus.at('解析[taglib]', object, context.input.file);      // 含格式检查、别名重复检查
            node.remove();
        });

        context.result.oTaglibs = oTaglibs;                                     // 保存[taglib]解析结果
    });

}());
