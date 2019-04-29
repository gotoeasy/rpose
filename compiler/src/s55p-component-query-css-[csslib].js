const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 组件单位按需查询引用样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let style = context.style;
        let oCssSet = style.csslibset = style.csslibset || new Set();                                       // 组件单位样式库引用的样式
        let oCsslib = context.result.oCsslib;                                                               // 项目[csslib]+组件[csslib]
        let scriptclassnames = context.script.classnames;
        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? (cls+ '@' + pkg) : cls );        // 自定义改名函数
        let strict = true;                                                                                  // 样式库严格匹配模式
        let universal = false;                                                                              // 不查取通用样式
        let opts = {rename, strict, universal};

        let ary, oQuerys = {};
        root.walk( 'Class', (node, object) => {
            // 按样式库单位汇总组件内全部样式类
            for ( let i=0,clspkg,clsname,asname; clspkg=object.classes[i++]; ) {
                ary = clspkg.split('@');
                clsname = '.' + ary[0];                                                                     // 类名
                asname = ary.length > 1 ? ary[1] : '*';                                                     // 库别名
                (oQuerys[asname] = oQuerys[asname] || []).push(clsname);                                    // 按库名单位汇总样式类，后续组件单位将一次性取出

                // '*'以外的样式库，检查指定样式库在（项目[csslib]+组件[csslib]）中是否存在
                if ( asname !== '*' && !oCsslib[asname] ) {
                    throw new Err('csslib not found: '+ asname, {file:context.input.file, text:context.input.text, start:object.loc.start.pos, end:object.loc.end.pos});
                }
            }
        });

        for ( let i=0,clspkg,clsname,asname; clspkg=scriptclassnames[i++]; ) {
            ary = clspkg.split('@');
            clsname = '.' + ary[0];                                                                         // 类名
            asname = ary.length > 1 ? ary[1] : '*';                                                         // 库别名
            (oQuerys[asname] = oQuerys[asname] || []).push(clsname);                                        // 按库名单位汇总样式类，后续组件单位将一次性取出

            // '*'以外的样式库，检查指定样式库在（项目[csslib]+组件[csslib]）中是否存在
            if ( asname !== '*' && !oCsslib[asname] ) {
                throw new Err('csslib not found (check classname in script): '+ asname + '\nfile:' + context.input.file);
            }
        }

        let csslib, tags = context.result.standardtags;                                                     // 用本组件的全部标准标签，解析完后才能用本插件
        for ( let asname in oQuerys ) {
            csslib = oCsslib[asname];
            csslib && oCssSet.add( csslib.get(...tags, ...new Set(oQuerys[asname]), opts) );                // 用本组件的全部标准标签+同一样式库的类名，查取样式库
        }

    });

}());

