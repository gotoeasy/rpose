const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const Err = require('@gotoeasy/err');

// TODO 模块包的配置处理？
bus.on('项目配置处理', function(result){

    return function(){
        if ( result ) return result;

        let env = bus.at('编译环境');
        let btfFile = env.path.root + '/rpose.config.btf';
        if ( !File.existsFile(btfFile) ) return {};
        
        let plugins = bus.on('项目配置处理插件');
        let rs = postobject(plugins).process({file: btfFile}, {log:env.debug});

        result = rs.result;
        return result;
    };

}());



// 解析项目的btf配置文件, 构建语法树
bus.on('项目配置处理插件', function(){
    
    return postobject.plugin(__filename, function(root, context){
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
    return postobject.plugin(__filename, function(root, context){

        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (lib, cls) => hashClassName(context.input.file, lib ? (cls+ '@' + lib) : cls );  // 自定义改名函数
        let opts = {rename};

        let oKv;
        root.walk( 'csslib', (node, object) => {
            oKv = parseCsslib(object.value, context, object.loc);
            node.remove();
        });
        if ( !oKv ) return;

        let csslibs = context.result.csslibs = [];
        for ( let k in oKv ) {
            csslibs.push( bus.at('样式库', k==='*'?'':k, oKv[k]) );
            if ( k === '*' ) {
                context.result.nonameCsslib = csslibs.pop();
            }
        }

    });
}());


// 日志
bus.on('项目配置处理插件', function(){
    return postobject.plugin(__filename, function(root, context){
//        console.info('[process-project-config]', JSON.stringify( root , null, 4) );
    });
}());



function parseCsslib(csslib, context, loc){
    let rs = {};
    let lines = (csslib == null ? '' : csslib.trim()).split('\n');

    for ( let i=0,line; i<lines.length; i++ ) {
        line = lines[i];
        let key, value, idx = line.indexOf('=');                    // libname = npmpkg : filter, filter, filter
        if ( idx < 0) continue;

        key = line.substring(0, idx).trim();
        value = line.substring(idx+1).trim();

        idx = value.lastIndexOf('//');
        idx >= 0 && (value = value.substring(0, idx).trim());       // 去注释，无语法分析，可能会误判

        if ( !key ) {
            throw new Err('use * as empty csslib name. etc. * = ' + value, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 })
        }

        if ( rs[key] ) {
            throw new Err('duplicate csslib name: ' + key, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 })
        }
        rs[key] = value;
    }

    return rs;
}
