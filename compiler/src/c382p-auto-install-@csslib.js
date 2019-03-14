const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 @csslib
    // 检查安装
    return postobject.plugin(__filename, function(root, context){

        let style = context.style;
        let oCssSet = new Set();

        root.walk( '@csslib', (node, object) => {

            if ( bus.at('是否表达式', object.value) ) {
                // 属性 @csslib 不能使用表达式
                throw new Err('@csslib unsupport the expression', {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
            }

            // 查找Class属性节点
            let classNode;
            for ( let i=0,nd; nd=node.parent.nodes[i++]; ) {
                if ( nd.type === 'Class' ) {
                    classNode = nd;
                    break;  // 找到
                }
            }
            if ( !classNode || !classNode.object.classes ) return;             // 没有类不需处理


            let name = '', imps, ary = object.value.split('=');
            if ( ary.length > 1 ) {
                name = ary[0].trim();
                imps = ary[1];
            }else{
                imps = object.value;
            }
            let csslib = bus.at('样式库', name, imps);


            let hashClsName = bus.on('哈希样式类名')[0];
            let rename = (pkg, cls) => hashClsName(context.input.file, cls);
            let opts = {rename};

            classNode.object.classes.forEach(cls => {
                if ( name ) {
                    // 有指定库名，类名去除包名后查询
                    let csspkg = cls.split('@');
                    if ( csspkg.length > 1 ) {
                        name === csspkg[1] && oCssSet.add( csslib.get('.' + csspkg[0]) );           // 指定包名时，包名相同才查库，默认改名规则
                    }else{
                        oCssSet.add( csslib.get('.' + cls, opts) );                                 // 没有指定包名时，直接查库，组件范围改名规则
                    }
                }else{
                    oCssSet.add( csslib.get('.' + cls, opts) );                                     // 没有指定库名，直接查库，组件范围改名规则
                }
            });

        });


        style.csslib = [...oCssSet].join('\n');

    });

}());

