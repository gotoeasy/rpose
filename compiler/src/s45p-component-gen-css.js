const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const csjs = require('@gotoeasy/csjs');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){


        let style = context.style;
        let ary = [];
        style.csslibset && ary.push(...style.csslibset);
        style.less && ary.push(style.less);
        style.scss && ary.push(style.scss);
        style.css && ary.push(style.css);
        
        context.result.css = bus.at('组件样式类名哈希化', context.input.file, ary.join('\n'));

        let env  = bus.at('编译环境');
        let file = env.path.build_temp + '/' + bus.at('组件目标文件名', context.input.file) + '.css';
        if ( !env.release ) {
            if ( context.result.css ) {
                File.write(file, context.result.css);
            }else{
                File.remove(file);
            }
        }

    });

}());

