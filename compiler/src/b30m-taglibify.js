const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const csslibify = require('csslibify');

bus.on('标签库定义', function(rs={}){
    
    // [tag] 
    //   c-btn=pkg:ui-button
    //   ui-button=pkg
    //   pkg:ui-button
    bus.on('标签库引用', function (tag, fileOrRoot){
       let root = File.existsDir(fileOrRoot) ? fileOrRoot : bus.at('文件所在项目根目录', fileOrRoot);
       let ary = tag.split(':');
       let name = ary.length>1 ? ary[1].trim() : tag.trim();
       let key = root + ':' + name;
       return rs[key];  // 返回相应的源文件
    });

    // ----------------------------------------------------
    // 调用例子
    // bus.at('标签库定义', 'c-btn=pkg:ui-button', file)
    // bus.at('标签库定义', 'ui-button=pkg', file)
    // bus.at('标签库定义', 'pkg:ui-button', file)
    // 
    // [defTaglib] 
    //   c-btn=pkg:ui-button
    //   ui-button=pkg
    //   pkg:ui-button
    return function (defTaglib, file){

        let root, key, astag, pkg, tag, tagpkg, match, oPkg;

        root = bus.at('文件所在项目根目录', file);

        if ( (match = defTaglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
            // c-btn=@scope/pkg:ui-button
            astag = match[1];                       // c-btn=@scope/pkg:ui-button => c-btn
            pkg = match[2];                         // c-btn=@scope/pkg:ui-button => @scope/pkg
            tag = match[3];                         // c-btn=@scope/pkg:ui-button => ui-button

            key = root + ':' + astag;
            if ( rs[key] ) return;
            
        }else if ( (match = defTaglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*$/)) ) {
            // ui-button=@scope/pkg
            astag = match[1];                       // ui-button=@scope/pkg => ui-button
            pkg = match[2];                         // ui-button=@scope/pkg => @scope/pkg
            tag = match[1];                         // ui-button=@scope/pkg => ui-button

            key = root + ':' + astag;
            if ( rs[key] ) return;

        }else if ( (match = defTaglib.match(/^\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
            // @scope/pkg:ui-button
            astag = match[2];                       // @scope/pkg:ui-button => ui-button
            pkg = match[1];                         // @scope/pkg:ui-button => @scope/pkg
            tag = match[2];                         // @scope/pkg:ui-button => ui-button

            key = root + ':' + astag;
            if ( rs[key] ) return;

        }else{
            // 不支持的格式
            return;
        }

        bus.at('自动安装', pkg);                    // @scope/pkg
        oPkg = bus.at('模块组件信息', pkg);         // @scope/pkg
        for ( let i=0,rposeFile; rposeFile=oPkg.files[i++]; ) {
            if ( rposeFile.endsWith( `/${tag}.rpose` ) ) {
                // 找到源文件
                rs[key] = rposeFile;
                rs[oPkg.path + ':' + tag] = rposeFile;
                return;
            }
        }

        bus.at('项目配置处理', oPkg.config);    // 继续解析该项目配置文件，缓存解析结果
    }


}());

