const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 组件单位按需查询引用样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oPrjContext = bus.at("项目配置处理", context.input.file);
        let oPrjCsslibs = oPrjContext.result.oCsslibs;                                                      // 项目[csslib]配置的样式库 (asname：lib)
        let oCsslibs = context.result.oCsslibs;                                                             // 组件[csslib]配置的样式库 (asname：lib)
        let oAtCsslibs = context.result.oAtCsslibs = context.result.oAtCsslibs || {};                       // 组件@csslib配置的样式库 (asname：lib)

        let style = context.style;
        let oCssSet = style.csslibset = style.csslibset || new Set();                                       // 组件单位样式库引用的样式
        let scriptclassnames = context.script.classnames;
        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (pkg, cls) => hashClassName(context.input.file, cls+ '@' + pkg);                       // 自定义改名函数(总是加@)
        let strict = true;                                                                                  // 样式库严格匹配模式
        let universal = false;                                                                              // 不查取通用样式
        let opts = {rename, strict, universal};

        let ary, oQuerys = {};
        let nonameCsslibPC = oCsslibs['*'] || oPrjCsslibs['*'];                                             // 组件或项目[csslib]配置的无名样式库对象（别名为*）
        let nonameCsslibPCA = oAtCsslibs['*'] || oCsslibs['*'] || oPrjCsslibs['*'];                         // [csslib]或@csslib的无名样式库对象（别名为*）
        // view中@csslib部分已生成样式存放于atcsslibtagcss，剩余[csslib]部分需要生成
        root.walk( 'Class', (node, object) => {
            // 按样式库单位汇总组件内全部样式类
            for ( let i=0,clspkg,clsname,asname; clspkg=object.classes[i++]; ) {
                ary = clspkg.split('@');
                clsname = '.' + ary[0];                                                                     // 类名
                asname = ary.length > 1 ? ary[1] : '*';                                                     // 库别名
                if ( asname === '*' ) {
                    if ( nonameCsslibPC && nonameCsslibPC.has(clsname) ) {
                        (oQuerys[asname] = oQuerys[asname] || []).push(clsname);                            // 按库名单位汇总样式类，后续组件单位将一次性取出，仅[csslib]有无名库且能查到时才汇总
                    }
                }else{
                    (oQuerys[asname] = oQuerys[asname] || []).push(clsname);                                // 按库名单位汇总样式类，后续组件单位将一次性取出
                }
            }
        });

        // 检查js脚本中的样式库是否正确
        for ( let i=0,clspkg,clsname,asname; clspkg=scriptclassnames[i++]; ) {
            ary = clspkg.split('@');
            clsname = '.' + ary[0];                                                                         // 类名
            asname = ary.length > 1 ? ary[1] : '*';                                                         // 库别名

            if ( asname === '*' ) {
                // 【注意】 @csslib有*，脚本中所有无名样式类，只要存在@csslib中的都会被相应改名，可能会出现冲突误改
                if ( nonameCsslibPCA && nonameCsslibPCA.has(clsname) ) {
                    (oQuerys[asname] = oQuerys[asname] || []).push(clsname);                                // 按库名单位汇总样式类，后续组件单位将一次性取出，有无名库且能查到时才汇总
                }
            }else{
                // '*'以外的样式库，检查指定样式库在（项目[csslib]+组件[csslib]+@csslib）中是否存在
                if ( !oAtCsslibs[asname] && !oCsslibs[asname] && !oPrjCsslibs[asname] ) {
                    throw new Err('csslib not found (check classname in script): '+ asname + '\nfile:' + context.input.file);   // TODO 友好提示
                }
            }

        }

        let csslib, tags = context.result.standardtags;                                                     // 用本组件的全部标准标签，解析完后才能用本插件
        for ( let asname in oQuerys ) {
            // 在js脚本中可能有无名库样式类，所以总是要查出来
            csslib = oAtCsslibs[asname] || oCsslibs[asname] || oPrjCsslibs[asname];                         // 别名无重复，不会有问题
            if ( csslib ) {
                oCssSet.add( csslib.get(...tags, ...new Set(oQuerys[asname]), opts) );                      // 用本组件的全部标准标签+同一样式库的类名，查取样式库
            }else{
                // 应该检查过，在这里不应该还找不到样式库
                throw new Error('csslib not found: ' + asname);
            }
        }

    });

}());

