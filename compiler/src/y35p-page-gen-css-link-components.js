const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const hash = require('@gotoeasy/hash');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const postcss = require('postcss');
const csso = require('csso');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let env  = bus.at('编译环境');
        let allreferences = context.result.allreferences;

        let ary = [];
        allreferences.forEach(tagpkg => {
            //let ctx = bus.at('编译组件', tagpkg);
            let ctx = bus.at('组件编译缓存', bus.at('标签源文件', tagpkg));
            if ( !ctx ) {
                ctx = bus.at('编译组件', tagpkg);
            }
            ctx.result.css && ary.push(ctx.result.css);
        });

        context.result.css = ary.join('\n');
        if ( env.release ){
            context.result.css = csso.minify( ary.join('\n'), {forceMediaMerge: true} ).css;
        }

        //context.result.promiseCss = bus.at('编译页面CSS', context.result.css, context.input.file);
        //context.result.promiseCss = context.result.css;

        context.result.promiseCss = bus.at('编译页面样式', context.result.css, context.input.file);
    });

}());


bus.on('编译页面样式', function(){

    // -------------------------------------------------------------
    // 页面样式编译，同步处理，仅支持同步插件
    // 
    // 加前缀、复制url资源
    // -------------------------------------------------------------
    return (css, srcFile) => {

        let env  = bus.at('编译环境');
        let from = env.path.build_dist + '/from.css';                   // 页面由组件拼装，组件都在%build_dist%目录
        let to = bus.at('页面目标CSS文件名', srcFile);

        let hashbrowserslist = bus.at('browserslist');
        let hashpath = hash(bus.at('页面图片相对路径', srcFile));			// 结果和图片资源的相对目录相关
        let hashcss = hash(css);
        let cachefile = `${bus.at('缓存目录')}/normalize-page-css/${hashbrowserslist}-${hashpath}-${hashcss}.css`;

        if ( !env.nocache && File.existsFile(cachefile) ) return File.read(cachefile);

        // 修改url相对目录
        let url = 'rebase';
        postcssUrlOpt = {url};

        let plugins = [];
        plugins.push( require('autoprefixer')() );                        // 添加前缀
        plugins.push( require('postcss-url')(postcssUrlOpt) );                  // 修改url相对目录
//        plugins.push( require('postcss-discard-comments')({remove:x=>1}) );     // 删除所有注释

        let rs = postcss(plugins).process(css, {from, to}).sync().root.toResult();
        File.write(cachefile, rs.css);
        return rs.css;
    }

}());

