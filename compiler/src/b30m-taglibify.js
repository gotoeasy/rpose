const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const csslibify = require('csslibify');

bus.on('标签库定义', function(rs={}){
    
    // [tag] 
    //   c-btn=pkg:ui-button
    //   ui-button=pkg
    //   pkg:ui-button
    //   ui-button
    bus.on('标签库引用', function (tag, fileOrRoot){
       let searchPkg = bus.at('文件所在模块', fileOrRoot);
       let name, idx1 = tag.indexOf('='), idx2 = tag.indexOf(':');

       if ( idx1 < 0 && idx2 < 0 ) {
           name = tag.trim();                       // ui-button => ui-button
       } else if ( idx2 > 0 ) {
           name = tag.substring(idx2+1).trim();     // c-btn=pkg:ui-button => ui-button,  pkg:ui-button => ui-button
       }else{
           name = tag.substring(0, idx1).trim();    // ui-button=pkg => ui-button
       }

       let key = searchPkg + ':' + name;
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
    // [file] 
    //   用于定位该标签库根目录的文件
    return function (defTaglib, file){

        let askey, tagkey, astag, pkg, tag, match, oPkg, searchPkg = bus.at('文件所在模块', file);

        if ( (match = defTaglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
            // c-btn=@scope/pkg:ui-button
            astag = match[1];                       // c-btn=@scope/pkg:ui-button => c-btn
            pkg = match[2];                         // c-btn=@scope/pkg:ui-button => @scope/pkg
            tag = match[3];                         // c-btn=@scope/pkg:ui-button => ui-button
        }else if ( (match = defTaglib.match(/^\s*([\S]+)\s*=\s*([\S]+)\s*$/)) ) {
            // ui-button=@scope/pkg
            astag = match[1];                       // ui-button=@scope/pkg => ui-button
            pkg = match[2];                         // ui-button=@scope/pkg => @scope/pkg
            tag = match[1];                         // ui-button=@scope/pkg => ui-button
        }else if ( (match = defTaglib.match(/^\s*([\S]+)\s*:\s*([\S]+)\s*$/)) ) {
            // @scope/pkg:ui-button
            astag = match[2];                       // @scope/pkg:ui-button => ui-button
            pkg = match[1];                         // @scope/pkg:ui-button => @scope/pkg
            tag = match[2];                         // @scope/pkg:ui-button => ui-button
        }else{
            // 不支持的格式，无视
            return rs;
        }

        askey = searchPkg + ':' + astag;
        tagkey = pkg + ':' + tag;
        if ( rs[tagkey] ){
            rs[askey] = rs[tagkey];
            return rs;
        }

        bus.at('自动安装', pkg);                                         // @scope/pkg
        oPkg = bus.at('模块组件信息', pkg);                              // @scope/pkg
        for ( let i=0,key,rposeFile; rposeFile=oPkg.files[i++]; ) {
            key = oPkg.name + ':' + File.name(rposeFile);
            if ( rs[key] ) break;                                       // 缓存过了
            rs[key] = rposeFile;                                        // 缓存起来，路径：真实标签名
        }

        if ( rs[tagkey] ) {
            rs[askey] = rs[tagkey];                      // 缓存别名
        }
        bus.at('项目配置处理', oPkg.config);    // 继续解析该项目配置文件，缓存解析结果

        return rs;
    }


}());

