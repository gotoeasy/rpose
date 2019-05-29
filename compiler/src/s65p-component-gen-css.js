const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){


        let style = context.style;
        let ary = [];
        style.csslibset && ary.push(...style.csslibset);
        style.less && ary.push(style.less);
        style.scss && ary.push(style.scss);
        style.css && ary.push(style.css);
        style.atclasscss && ary.push(...style.atclasscss);
        
        context.result.css = bus.at('组件样式类名哈希化', context.input.file, ary.join('\n'));

        let env  = bus.at('编译环境');
        if ( !env.release ) {
            let fileCss = bus.at('组件目标临时CSS文件名', context.input.file);
            if ( context.result.css ) {
                File.write(fileCss, context.result.css);
            }else{
                File.remove(fileCss);
            }
        }

    });

}());

