const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const hash = require('@gotoeasy/hash');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;             // 仅针对页面

        let env  = bus.at('编译环境');
        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (pkg, cls) => hashClassName(context.input.file, pkg ? (cls+ '@' + pkg) : cls );    // 自定义改名函数
        let strict = true;                                      // 样式库严格匹配模式
        let universal = true;                                   // 查取通用样式（页面的缘故）
        let opts = {rename, strict, universal};


        // 在全部样式库中，用使用到的标准标签查询样式，汇总放前面
        let aryTagCss = [];
        let oCsslib = context.result.oCsslib;                   // 项目[csslib]+组件[csslib]
        let oCache = bus.at('缓存');
        for ( let k in oCsslib ) {
            let cacheKey = hash(JSON.stringify(['按需取标签样式', oCsslib[k].pkg, oCsslib[k].version, strict, universal, oCsslib[k]._imported, context.result.allstandardtags]));
            if ( !env.nocache ) {
                let cacheValue = oCache.get(cacheKey);
                if ( cacheValue ) {
                    aryTagCss.push(cacheValue);
                }else{
                    let tagcss = oCsslib[k].get(...context.result.allstandardtags, opts);
                    aryTagCss.push(tagcss);
                    oCache.set(cacheKey, tagcss);
                }
            }else{
                let tagcss = oCsslib[k].get(...context.result.allstandardtags, opts);
                aryTagCss.push(tagcss);
                oCache.set(cacheKey, tagcss);
            }
        }

        // 汇总所有使用到的组件的样式
        let ary = [];
        let allreferences = context.result.allreferences;                            // 已含页面自身组件
        allreferences.forEach(tagpkg => {
            let tagSrcFile = bus.at('标签源文件', tagpkg, context.result.oTaglibs);
            let ctx = bus.at('组件编译缓存', tagSrcFile);
            if ( !ctx ) {
                ctx = bus.at('编译组件', tagSrcFile);
            }
            ctx.result.atcsslibtagcss && aryTagCss.push(...ctx.result.atcsslibtagcss);             // @csslib的标签样式
            ctx.result.css && ary.push(ctx.result.css);
        });

        // 汇总后的页面样式做后处理
        context.result.css = [...aryTagCss, ...ary].join('\n');
        context.result.pageCss = bus.at('页面样式后处理', context.result.css, context);  // TODO @media样式合并存在不足
    });

}());

