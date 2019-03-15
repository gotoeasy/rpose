const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 @csslib
    // 检查安装
    return postobject.plugin(__filename, function(root, context){

        let style = context.style;
        let oCssSet = style.csslibset = style.csslibset || new Set();

        let prj = bus.at('项目配置处理', context.input.file);
        let csslibs = prj.csslibs || [];
        let nonameCsslib = prj.nonameCsslib;

        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (lib, cls) => hashClassName(context.input.file, lib ? (cls+ '@' + lib) : cls );  // 自定义改名函数
        let opts = {rename};


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

