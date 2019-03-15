const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 @csslib
    // 检查安装
    return postobject.plugin(__filename, function(root, context){

        let style = context.style;
        let oCssSet = style.csslibset = style.csslibset || new Set();
        let csslibs = [];
        let nonameCsslib;

        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (lib, cls) => hashClassName(context.input.file, lib ? (cls+ '@' + lib) : cls );  // 自定义改名函数
        let opts = {rename};

        // 遍历树中的csslib节点，处理完后删除该节点
        root.walk( 'RposeBlock', (node, object) => {

            if ( object.name.value !== 'csslib' ) return;
            if ( !object.text || !object.text.value || !object.text.value.trim() ) return;

            let rs = parseCsslib(object.text.value, context, object.text.loc);
            for ( let k in rs ) {
                csslibs.push( bus.at('样式库', k==='*'?'':k, rs[k]) );
                if ( k === '*' ) {
                    nonameCsslib = csslibs.pop();
                }
            }
            
            node.remove();
            return false;
        });


        // 收集本组件view中直接使用的样式类
        let oClass = new Set();         // 不含库名
        let oClassPkg = new Set();      // 含库名
        root.walk( 'Class', (node, object) => {
            object.classes.forEach(cls => {
                cls.indexOf('@') < 0 ? oClass.add('.' + cls) : oClassPkg.add('.' + cls);
            });
        });
    
        // 有无名库时，按需引用不含库名的样式类
        if ( nonameCsslib ) {
            oClass.forEach(cls => {
                oCssSet.add( nonameCsslib.get(cls, opts) );                   // 没有指定库名的样式类才按需引用该样式库
            })
        }
        
        // 按需引用含库名的样式类
        csslibs.forEach(csslib => {
            oClassPkg.forEach(cls => {
                let ary = cls.split('@');
                if ( ary[1] === csslib.name ) {
                    oCssSet.add( csslib.get(ary[0], opts) );            // 仅指定库名且库名一致的样式类才按需引用该样式库
                }
            })
        });

    
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
