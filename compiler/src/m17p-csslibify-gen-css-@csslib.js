const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 按需查询引用样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let style = context.style;
        let oCssSet = style.csslibset = style.csslibset || new Set();
        let oCsslib = Object.assign({}, context.result.oCsslib);                        // 复制(项目[csslib]+组件[csslib])

        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (pkg, cls) => hashClassName(context.input.file, pkg !== '*' ? (cls+ '@' + pkg) : cls );  // 自定义改名函数
        let opts = {rename};

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
                let tmpAry = object.value.split('=');
                let libname = tmpAry.length > 1 ? tmpAry[0].trim() : '*';               // 支持简写，如@csslib="pkg:**.min.css"，等同@csslib="*=pkg:**.min.css"
                let lib = bus.at('样式库', libname, csslibNode.object.value);
                oCsslib[libname] = lib;                                                 // 并入(前一步已检查)(项目[csslib]+组件[csslib]+标签[@csslib])
            }
            let nonameCsslib = oCsslib['*'];
            
            // 查库取样式
            object.classes.forEach(cls => {
                ary = cls.split('@');
                clsname = '.' + cls;

                // 普通样式类，按需引用无名库，找不到库或类都不报错
                if ( ary.length < 2 ) return nonameCsslib && oCssSet.add( nonameCsslib.get(clsname, opts) );

                // 别名样式类，按需引用别名库
                csslib = oCsslib[ary[1]];
                if ( !csslib ) {
                    // 指定别名的样式库不存在
                    throw new Err('csslib not found: '+ ary[1], {file:context.input.file, text:context.input.text, start:object.loc.start.pos, end:object.loc.end.pos});
                }
                
                clsname = '.' + ary[0];
                css = csslib.get(clsname, opts);
                if ( !css ) {
                    // 指定样式库中找不到指定的样式类
                    throw new Err('css class not found: '+ cls, {file:context.input.file, text:context.input.text, start:object.loc.start.pos, end:object.loc.end.pos});
                }
                oCssSet.add( css );            
            });
        });
    
    });

}());

