const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const hash = require('@gotoeasy/hash');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let env  = bus.at('编译环境');

        // 在全部样式库中，用使用到的标准标签查询样式，汇总放前面
        let aryTagCss = [];
        let oCsslib = context.result.oCsslib;
        let oCache = bus.at('缓存');
        for ( let k in oCsslib ) {
            let cacheKey = hash(JSON.stringify(['按需取标签样式', oCsslib[k].pkg, oCsslib[k].version, oCsslib[k]._imported, context.result.allstandardtags]));
            if ( !env.nocache ) {
                let cacheValue = oCache.get(cacheKey);
                if ( cacheValue ) {
                    aryTagCss.push(cacheValue);
                }else{
                    let tagcss = oCsslib[k].get(...context.result.allstandardtags);
                    aryTagCss.push(tagcss);
                    oCache.set(cacheKey, tagcss);
                }
            }else{
                let tagcss = oCsslib[k].get(...context.result.allstandardtags);
                aryTagCss.push(tagcss);
                oCache.set(cacheKey, tagcss);
            }
        }

        // 汇总所有使用到的组件的样式
        let ary = [];
       let allreferences = context.result.allreferences;                            // 已含页面自身组件
       allreferences.forEach(tagpkg => {
            let ctx = bus.at('组件编译缓存', bus.at('标签源文件', tagpkg));
            if ( !ctx ) {
                ctx = bus.at('编译组件', tagpkg);
            }
            ctx.result.atcsslibtagcss && aryTagCss.push(...ctx.result.atcsslibtagcss);             // @csslib的标签样式
            ctx.result.css && ary.push(ctx.result.css);
        });

        // 汇总后的页面样式做后处理
        context.result.css = [...aryTagCss, ...ary].join('\n');
        context.result.pageCss = bus.at('页面样式后处理', context.result.css, context.input.file);  // TODO @media样式合并存在不足
    });

}());

