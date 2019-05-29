const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const Err = require('@gotoeasy/err');
const postobject = require('@gotoeasy/postobject');

bus.on('编译组件', function (){

    return function(infile){

        let oFile;
        if ( infile.file ) {
            oFile = infile;       // 项目源文件对象
        }else{
            let file, text, hashcode;
            file = bus.at('标签源文件', infile);   // 标签则转为源文件，源文件时还是源文件
            if ( !File.existsFile(file) ) {
                throw new Err(`file not found: ${file} (${infile})`);
            }
            text = File.read(file);
            hashcode = hash(text);
            oFile = {file, text, hashcode};
        }


        let env = bus.at('编译环境');
        let context = bus.at('组件编译缓存', oFile.file);
        if ( context && context.input.hashcode !== oFile.hashcode ) {
            context = bus.at('组件编译缓存', oFile.file, false);     // 删除该文件相应缓存
        }

        if ( !context ) {
            let plugins = bus.on('编译插件');
            return postobject(plugins).process({...oFile}, {log:env.debug});
        }

        return context;
    }

}());
