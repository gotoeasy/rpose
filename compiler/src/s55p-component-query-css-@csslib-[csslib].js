const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

const Alias = 'DEFAULT_ALIAS_AUTO_ADD';

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
        let rename = (pkg, cls) => hashClassName(context.input.file, cls+ '@' + pkg);                       // 自定义改名函数
        let strict = true;                                                                                  // 样式库严格匹配模式
        let universal = false;                                                                              // 不查取通用样式
        let opts = {rename, strict, universal};

        let ary, oQuerys = {};
        let nonameCsslibPC = oCsslibs['*'] || oPrjCsslibs['*'];                                             // 组件或项目[csslib]配置的无名样式库对象（别名为*）
        root.walk( 'Class', (node, object) => {
            // 按样式库单位汇总组件内全部样式类
            for ( let i=0,oCls,clsname,asname; oCls=object.classes[i++]; ) {
                ary = oCls.Name.value.split('@');
                clsname = '.' + ary[0];                                                                     // 类名
                asname = ary.length > 1 ? ary[1] : '';                                                      // 库别名 (无名库都已自动添加@别名后缀)

                // 前面已做别名库存在性检查，有别名时直接添加即可
                asname && (oQuerys[asname] = oQuerys[asname] || []).push(clsname);                          // 按库名单位汇总样式类，后续组件单位将一次性取出
            }
        });

        // 检查js脚本中的样式库是否正确
        for ( let i=0,clspkg,clsname,asname; clspkg=scriptclassnames[i++]; ) {
            ary = clspkg.split('@');
            clsname = '.' + ary[0];                                                                         // 类名
            asname = ary.length > 1 ? ary[1] : '*';                                                         // 库别名

            if ( asname === '*' ) {
                if ( nonameCsslibPC ) {
                    // 忽视@csslib无名库，@csslib无名库仅单一标签有效，脚本中多出的不管
                    (oQuerys[Alias] = oQuerys[Alias] || []).push(clsname);                                  // 仅[csslib]有无名库时才汇总
                }
            }else{
                // 别名库，检查指定样式库在（项目[csslib]+组件[csslib]+@csslib）中是否存在
                if ( !oAtCsslibs[asname] && !oCsslibs[asname] && !oPrjCsslibs[asname] ) {
                    throw new Err('csslib not found (check classname in script): '+ asname + '\nfile:' + context.input.file);   // TODO 友好提示
                }
            }

        }

        let csslib, tags = context.result.standardtags;                                                     // 用本组件的全部标准标签，解析完后才能用本插件
        for ( let alias in oQuerys ) {

            csslib = oAtCsslibs[alias] || oCsslibs[alias] || oPrjCsslibs[alias];                            // 别名无重复，不会有问题
            if ( !csslib ) {
                throw new Error('csslib not found: ' + alias);                                              // 应该检查过，在这里不应该还找不到样式库
            }

            if ( csslib.isAtCsslib ) {
                oCssSet.add( csslib.get(csslib.attag, ...new Set(oQuerys[alias]), opts) );                  // @csslib样式库
            }else{
                oCssSet.add( csslib.get(...tags, ...new Set(oQuerys[alias]), opts) );                       // [csslib]样式库，用本组件的全部标准标签+相关样式类进行查询
            }
        }

    });

}());

