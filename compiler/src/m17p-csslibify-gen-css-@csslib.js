const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 含@csslib的标签，按需查询引用样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oCsslibPkgs = context.result.oCsslibPkgs;                                                   // 样式库匿名集合
        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? (cls+ '@' + pkg) : cls );    // 自定义改名函数
        let strict = true;                                                                              // 样式库严格匹配模式
        let atcsslibtagcss = context.result.atcsslibtagcss = context.result.atcsslibtagcss || [];       // @csslib的标准标签样式

        root.walk( 'Class', (node, object) => {

            // 查找@csslib属性节点，@csslib仅作用于当前所在标签，汇总当前标签和样式类，用当前样式库按严格匹配模式一次性取出
            let csslibNode, atcsslib, querys = [];
            for ( let i=0,nd; nd=node.parent.nodes[i++]; ) {
                if ( nd.type === '@csslib' ) {
                    csslibNode = nd;
                    break;  // 找到
                }
            }
            if ( csslibNode ) {
                atcsslib = bus.at('样式库', csslibNode.object.value);
                oCsslibPkgs[atcsslib.name] = atcsslib.pkg;                                              // 保存样式库匿名关系，用于脚本类名转换
                node.parent.object.standard && querys.push(node.parent.object.value);                   // 标准标签名
                for ( let i=0,ary,clspkg,clsname,asname; clspkg=object.classes[i++]; ) {
                    ary = clspkg.split('@');
                    clsname = '.' + ary[0];                                                             // 类名
                    asname = ary.length > 1 ? ary[1] : '*';                                             // 库别名
                    if ( atcsslib.pkg === asname ) {
                        querys.push(clsname);                                                           // 匹配当前样式库待查的样式类

                        if ( !atcsslib.has(clsname) ) {
                            // 按宽松模式检查样式库是否有指定样式类，没有则报错
                            throw new Err('css class not found: '+ clsname, {file:context.input.file, text:context.input.text, start:object.loc.start.pos, end:object.loc.end.pos});
                        }
                    }
                }

                querys.length && atcsslibtagcss.push( atcsslib.get(...querys, {rename, strict}) );      // 用当前样式库一次性查取
            }

        });
    
    });

}());

