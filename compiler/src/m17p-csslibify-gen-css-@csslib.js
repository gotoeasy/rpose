const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 按需查询引用样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let style = context.style;
        let oCssSet = style.csslibset = style.csslibset || new Set();
        let oCsslib = Object.assign({}, context.result.oCsslib);                        // 复制(项目[csslib]+组件[csslib])
        let oCsslibPkgs = context.result.oCsslibPkgs;
        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? (cls+ '@' + pkg) : cls );  // 自定义改名函数
        let opts = {rename};
        let atcsslibtagcss = context.result.atcsslibtagcss = context.result.atcsslibtagcss || [];   // @csslib的标准标签样式

        let ary, clsname, csslib, css;
        root.walk( 'Class', (node, object) => {

            // 查找@csslib属性节点
            let csslibNode;
            for ( let i=0,nd; nd=node.parent.nodes[i++]; ) {
                if ( nd.type === '@csslib' ) {
                    csslibNode = nd;
                    break;  // 找到
                }
            }
            if ( csslibNode ) {
                let atcsslib = bus.at('样式库', csslibNode.object.value);
                oCsslib[atcsslib.name] = atcsslib;                                      // 并入(前一步已检查)(项目[csslib]+组件[csslib]+标签[@csslib])
                oCsslibPkgs[atcsslib.name] = atcsslib.pkg;

                // @csslib仅作用于所在标签，所以要把标签样式取出
                node.parent.object.standard && atcsslibtagcss.push(atcsslib.get(node.parent.object.value));
            }
            let nonameCsslib = oCsslib['*'];

            // 查库取样式，把样式库匿名改成真实库名
            for ( let i=0,clspkg,clsname,asname; clspkg=object.classes[i++]; ) {
                ary = clspkg.split('@');
                clsname = '.' + ary[0];                         // 类名
                asname = ary.length > 1 ? ary[1] : '';          // 库别名

                if ( asname ) {
                    // 别名样式类，按需引用别名库
                    csslib = oCsslib[asname];
                    if ( !csslib ) {
                        // 指定别名的样式库不存在
                        throw new Err('csslib not found: '+ asname, {file:context.input.file, text:context.input.text, start:object.loc.start.pos, end:object.loc.end.pos});
                    }
                    
                    css = csslib.get(clsname, opts);
                    if ( !css ) {
                        // 指定样式库中找不到指定的样式类
                        throw new Err('css class not found: '+ clsname, {file:context.input.file, text:context.input.text, start:object.loc.start.pos, end:object.loc.end.pos});
                    }
                    oCssSet.add( css );

                }else{
                    // 普通样式类，按需引用无名库，找不到库或类都不报错
                    nonameCsslib && oCssSet.add( nonameCsslib.get(clsname, opts) );
                }

            }

        });
    
    });

}());

