const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 @csslib
    // 检查安装
    return postobject.plugin(__filename, function(root, context){

        let style = context.style;
        let oCssSet = style.csslibset = style.csslibset || new Set();

        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (lib, cls) => hashClassName(context.input.file, lib ? (cls+ '@' + lib) : cls );  // 自定义改名函数
        let opts = {rename};

        // @csslib定义的是无名库时(pkg:**.cs或*=pkg:**.cs)，意思是本标签上的无库名样式类将引用该库 （foo、bar之类按需引用）
        // @csslib定义的是有名库时(lib=pkg:**.cs)，意思是本标签上的有库名样式类将引用该库 （foo@lib、bar@lib之类按需引用），且库名必须一致
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
            if ( !classNode || !classNode.object.classes ) return;                          // 没有类不需处理

            // 建库
            let tmpAry = object.value.split('=');
            let libname = tmpAry.length > 1 ? tmpAry[0].trim() : '';
            libname === '*' && (libname = '');
            let csslib = bus.at('样式库', libname, object.value);   // TODO 安装失败报错，同步。。。

            if ( libname ) {
                // 有库名时，适用特定库名样式类
                classNode.object.classes.forEach(cls => {
                    let ary = cls.split('@');
                    ary[1] === libname && oCssSet.add( csslib.get('.' + ary[0], opts) );    // 仅指定库名且库名一致的样式类才按需引用该样式库
                });
            }else{
                // 无库名时，适用普通样式类
                classNode.object.classes.forEach(cls => {
                    cls.indexOf('@') < 0 && oCssSet.add( csslib.get('.' + cls, opts) );     // 没有指定库名的样式类才按需引用该样式库
                });
            }

        });


    });

}());

