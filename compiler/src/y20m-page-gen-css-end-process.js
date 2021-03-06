const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const Err = require('@gotoeasy/err');
const postcss = require('postcss');
const csso = require('csso');

bus.on('页面样式后处理', function(){

    // -------------------------------------------------------------
    // 页面样式编译，同步处理，仅支持同步插件
    // 
    // 加前缀、复制url资源、压缩/格式化
    // -------------------------------------------------------------
    return (css, context) => {

        if ( !css ) return '';

        let env = bus.at('编译环境');
        let oCache = bus.at('缓存');
        let from = oCache.path + '/resources/from.css';                                 // 页面由组件拼装，组件都在%缓存目录%/resources
        let to = bus.at('页面目标CSS文件名', context.input.file);
        let desktopFirst = !!context.doc.api.desktopfirst;                              // 移动优先时，min-width => max-width => min-device-width => max-device-width => other；桌面优先时，max-width => max-device-width => min-width => min-device-width => other

        let pageCss;
        let plugins = [];
        // 修改url相对目录
        let url = 'copy';
        let basePath = bus.at('缓存资源目录数组');                                       // 缓存资源目录中找，包括编译缓存的资源目录，和样式库缓存的资源目录
        let useHash = false;                                                            // 编译的组件样式已统一哈希文件名
        let assetsPath = bus.at('页面图片相对路径', context.input.file);
        let postcssUrlOpt = {url, basePath, assetsPath, useHash };

        let cacheKey = JSON.stringify(['页面样式后处理', bus.at('browserslist'), env.release, desktopFirst, assetsPath, css]);
        if ( !env.nocache ) {
            let cacheValue = oCache.get(cacheKey);
            if ( cacheValue ) {
                if ( cacheValue.indexOf('url(') > 0 ) {
                    plugins.push( require('postcss-url')(postcssUrlOpt) );              // 复制图片资源（文件可能被clean掉，保险起见执行资源复制）
                    postcss(plugins).process(css, {from, to}).sync().root.toResult();   // 仍旧用组件样式
                }
                return cacheValue;
            }
        }

        try{
            css = csso.minify(css, {forceMediaMerge: true, comments: false}).css;       // 压缩样式，合并@media
        }catch(e){
            // 样式有误导致处理失败
            throw new Err('css end process failed', 'file: ' + context.input.file, e);
        }

        plugins.push( require('autoprefixer')() );                                      // 添加前缀
        plugins.push( require('postcss-url')(postcssUrlOpt) );                          // 修改url相对目录
        plugins.push( require('postcss-sort-media')({desktopFirst}) );                  // 把@media统一放后面，按指定的排序方式（移动优先还是桌面优先）对@media进行排序

        let rs = postcss(plugins).process(css, {from, to}).sync().root.toResult();

        pageCss = env.release ? rs.css : csjs.formatCss(rs.css);                        // 非release时格式化

        return oCache.set(cacheKey, pageCss);
    }

}());

