const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const postobject = require('@gotoeasy/postobject');

bus.on('编译组件', function (){

    return function(srcfile, src, hashcode=''){
        
        let file = srcfile;
        let text = src;
        !File.existsFile(file) && (file = bus.at('标签源文件', srcfile));
        !text && (text = File.read(file));


        let env = bus.at('编译环境');
        let context = bus.at('组件编译缓存', file);

        if ( context && context.input.hashcode !== hashcode ) {
            context = bus.at('组件编译缓存', srcfile, false);     // 删除该文件相应缓存
        }

        if ( !context ) {
            let plugins = bus.on('编译插件');
            return postobject(plugins).process({file, text, hashcode}, {log:env.debug});
        }

        return context;
    }

}());
