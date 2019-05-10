const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const Btf = require('@gotoeasy/btf');

// TODO 配置文件修改时，rs可能有错误的缓存数据
bus.on('标签库定义', function(rs={}, rsPkg={}){
    
    let stack = [];

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

    // ----------------------------------------------------------
    // 
    // 【注意是在已安装好依赖包的前提下调用】，例子（file用于确定模块）
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    // 
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

        // 默认关联defTaglib指定包的全部源文件，存放内存
        let oTaglib = bus.at('normalize-taglib', defTaglib);
        initPkgDefaultTag(oTaglib.pkg);                                                         // 源文件组件标签，有无@前缀都支持直接用

        // 在file所在模块中查找已有关联
        let ataskey, askey, tagkey, searchPkg = bus.at('文件所在模块', file);
        stack.push(`[${searchPkg}] ${oTaglib.taglib}`);                                         // 错误提示用，oTaglib.taglib等同原定义串

        ataskey = searchPkg + ':' + oTaglib.atastag;                                            // pkg:@astag
        askey = searchPkg + ':' + oTaglib.astag;                                                // pkg:astag or pkg:@astag
        tagkey = oTaglib.pkg + ':' + oTaglib.tag;                                               // pkg:tag
        if ( rs[tagkey] ){
            // 在file所在包中，按defTaglib定义能找到源文件，这时把定义的别名也一起关联上
            rs[ataskey] = rs[tagkey];                                                           // 关联@前缀别名
            if ( !oTaglib.astag.startsWith('@') ) {
                if ( oTaglib.astag !== oTaglib.tag && rs[askey] && oTaglib.astag === File.name(rs[askey]) ) {
                    let msg = stack.join('\n => ');
                    msg += '\ntaglib aliases conflict with really component: ' + defTaglib
                        + '\n(' + oTaglib.astag + ' / ' +rs[askey] + ')';
                    stack = [];
                    throw new Error( msg );                                                     // 无@前缀的别名和指定包的源文件名冲突，不允许这样任性混淆，跑错
                }else{
                    rs[askey] = rs[tagkey];                                                     // 没有冲突则一起关联
                }
            }
            stack = [];
            return rs;                                                                          // 按组件标签能找到源文件，返回
        }

        // 通过项目配置查找关联 （不采用安装全部依赖包的方案，按需关联使用以减少不必要的下载和解析）
        let pkgfile;
        try{
            pkgfile = require.resolve(oTaglib.pkg + '/package.json', {paths: [bus.at('编译环境').path.root, __dirname]});
        }catch(e){
            stack.unshift(e.message);
            let msg = stack.join('\n => ');
            stack = [];
            // 不应该找不到package.json，通常是依赖的package未安装或安装失败导致
            throw new Err( msg, e );
        }
        let configfile = File.path(pkgfile) + '/rpose.config.btf';
        if ( !File.existsFile(configfile) ) {
            stack.unshift(`tag [${oTaglib.tag}] not found in package [${oTaglib.pkg}]`);
            let msg = stack.join('\n => ');
            stack = [];
            throw new Error( msg );                                                             // 源文件找不到，又没有配置，错误
        }

        // 解析配置文件中[taglib]的全部别名存到 oTaglibKv
        let btf = new Btf(configfile);
        let oTaglibKv, taglibBlockText = btf.getText('taglib');                                 // 已发布的包，通常不会有错，不必细致检查
        try{
            oTaglibKv = bus.at('解析[taglib]', taglibBlockText, {input:{file: configfile}});    // 单纯解析，不做安装
        }catch(e){
            stack.push(`[${oTaglib.pkg}] ${oTaglib.pkg}:${oTaglib.tag}`);                       // 错误提示用
            stack.push(configfile);
            stack.unshift(e.message);
            let msg = stack.join('\n => ');
            stack = [];
            // 通常是[taglib]解析失败导致
            throw new Error( msg, e );
        }

        let oConfTaglib = oTaglibKv[oTaglib.atastag];                                           // 在项目配置中用@前缀别名查找
        if ( !oConfTaglib ) {
            stack.push(configfile);
            stack.unshift(`tag [${oTaglib.astag}] not found in package [${oTaglib.pkg}]`);
            let msg = stack.join('\n => ');
            stack = [];
            throw new Error( msg );                                                             // 文件找不到，配置文件中也找不到别名配置，错误
        }


        // 通过项目配置查找关联 （不采用安装全部依赖包的方案，按需关联使用以减少不必要的下载和解析）
        bus.at('自动安装', oConfTaglib.pkg);                                                    // 项目配置中找到的别名定义，自动安装起来
        return bus.at('标签库定义', oConfTaglib.taglib, configfile);                            // 继续递归定义，要么直到查得源文件而成功，要么异常
    }

    function initPkgDefaultTag(pkg){
        if ( !rsPkg[pkg] ) {
            let oPkg = bus.at('模块组件信息', pkg);                                              // @scope/pkg
            for ( let i=0,file,tag; file=oPkg.files[i++]; ) {
                tag = File.name(file).toLowerCase();
                rs[oPkg.name + ':' + tag] = file;                                               // 包名：标签 = 文件
                rs[oPkg.name + ':@' + tag] = file;                                              // 包名：@标签 = 文件
            }
            rsPkg[pkg] = true;
        }
    }

}());

