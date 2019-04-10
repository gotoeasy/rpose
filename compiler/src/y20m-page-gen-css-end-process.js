const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const postcss = require('postcss');

bus.on('页面样式后处理', function(){

    // -------------------------------------------------------------
    // 页面样式编译，同步处理，仅支持同步插件
    // 
    // 加前缀、复制url资源、压缩/格式化
    // -------------------------------------------------------------
    return (css, srcFile) => {

        if ( !css ) return '';

        let env = bus.at('编译环境');
        let oCache = bus.at('缓存');
        let from = oCache.path + '/from.css';                                       // 页面由组件拼装，组件都在%缓存目录%目录
        let to = bus.at('页面目标CSS文件名', srcFile);

        let pageCss;
        let plugins = [];
        // 修改url相对目录
        let url = 'copy';
        let basePath = oCache.path + '/resources';                                  // 组件样式目录和资源目录相同
        let useHash = false;                                                        // 组件样式统一处理时已哈希化
        let assetsPath = bus.at('页面图片相对路径', srcFile);
        let postcssUrlOpt = {url, basePath, assetsPath, useHash };

        let cacheKey = JSON.stringify(['页面样式后处理', bus.at('browserslist'), env.release, assetsPath, css]);
        if ( !env.nocache ) {
            let cacheValue = oCache.get(cacheKey);
            if ( cacheValue ) {
                if ( cacheValue.indexOf('url(') > 0 ) {
                    plugins.push( require('postcss-url')(postcssUrlOpt) );              // 复制图片资源（文件可能被clean掉，保险起见执行资源复制）
                    postcss(plugins).process(cacheValue, {from, to}).sync().root.toResult();
                }
                return cacheValue;
            }
        }

	    plugins.push( require('postcss-discard-comments')({remove:x=>1}) );	        // 删除所有注释
	    plugins.push( require('postcss-normalize-whitespace') );					// 压缩删除换行空格
	    plugins.push( require('postcss-discard-empty') );							// 删除空样式（@font-face;h1{}{color:blue}h2{color:}h3{color:red} => h3{color:red}）
	    plugins.push( require('postcss-discard-duplicates') );						// 删除重复样式（p{color:green}p{color:green;color:green} => p{color:green}）
        plugins.push( require('autoprefixer')() );                                  // 添加前缀
        plugins.push( require('postcss-url')(postcssUrlOpt) );                      // 修改url相对目录
        plugins.push( require('postcss-merge-rules')() );                           // 合并规则

        let rs = postcss(plugins).process(css, {from, to}).sync().root.toResult();

        pageCss = env.release ? rs.css : csjs.formatCss(rs.css);                    // 非release时格式化
        return oCache.set(cacheKey, pageCss);
    }

}());

