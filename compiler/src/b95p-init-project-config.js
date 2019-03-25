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


        if ( result[btfFile] ) return result[btfFile];
        if ( !File.existsFile(btfFile) ) return {};

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

        let oKv, taglibObj;
        root.walk( 'taglib', (node, object) => {
            oKv = bus.at('解析[taglib]', object.value, context, object.loc);
            taglibObj = object;
            node.remove();
        });
        
        context.result.oTaglib = oKv || {}; // 存键值，用于检查重复
        if ( !oKv ) return;

        // 取出[taglib]中的有效行
        let mTaglib = new Map(), lines = taglibObj.value.trim().split('\n');
        for ( let i=0,oTaglib; i<lines.length; i++ ) {
            oTaglib = normalizeTaglib(lines[i], i);
            oTaglib && mTaglib.set(oTaglib.taglib, oTaglib);
        }

        // 循环注册别名
        let searchPkg = bus.at('文件所在模块', context.input.file);
        let oTaglibDef = bus.at('标签库定义', '', searchPkg);                          // 取已定义的标签库结果对象
        let regists = [];
        while ( (regists = registerTaglib(mTaglib, oTaglibDef, searchPkg)) ) {
            regists.forEach( v => mTaglib.delete(v.taglib) );
        }
        
        // 仍有别名未注册，提示错误
        if ( mTaglib.size ) {
            let keys = [...mTaglib.keys()];
            let oTaglib = mTaglib.get(keys[0]);
            throw new Err(`tag [${oTaglib.tag}] not found in package [${oTaglib.pkg}]`, { file: context.input.file, text: context.input.text, line: taglibObj.loc.start.line + oTaglib.line, column: 1 });
        }

    });
}());

function registerTaglib(mTaglib, oTaglibDef, searchPkg){

    let regists = [];
    mTaglib.forEach(oTaglib => {
        if ( oTaglibDef[oTaglib.pkg+':'+oTaglib.tag] ) {
            if ( !oTaglibDef[searchPkg+':'+oTaglib.astag] ) {
                oTaglibDef[searchPkg+':'+oTaglib.astag] = oTaglibDef[oTaglib.pkg+':'+oTaglib.tag];
            }
            regists.push(oTaglib);
        }
    });
    return regists.length ? regists : null;
}

function normalizeTaglib(taglib, line){

    let astag, pkg, tag, match;
    if ( (match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
        // c-btn=@scope/pkg:ui-button
        astag = match[1];                       // c-btn=@scope/pkg:ui-button => c-btn
        pkg = match[2];                         // c-btn=@scope/pkg:ui-button => @scope/pkg
        tag = match[3];                         // c-btn=@scope/pkg:ui-button => ui-button
    }else if ( (match = taglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*$/)) ) {
        // ui-button=@scope/pkg
        astag = match[1];                       // ui-button=@scope/pkg => ui-button
        pkg = match[2];                         // ui-button=@scope/pkg => @scope/pkg
        tag = match[1];                         // ui-button=@scope/pkg => ui-button
    }else if ( (match = taglib.match(/^\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
        // @scope/pkg:ui-button
        astag = match[2];                       // @scope/pkg:ui-button => ui-button
        pkg = match[1];                         // @scope/pkg:ui-button => @scope/pkg
        tag = match[2];                         // @scope/pkg:ui-button => ui-button
    }else{
        // 不支持的格式
        return undefined;
    }

    return { line, astag, pkg, tag, taglib: astag+'='+pkg+':'+tag };
}