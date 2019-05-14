const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

(function(rs={}){

    // 按taglib找源文件
    bus.on('标签库源文件', (taglib, stack=[]) => {

        // TODO 循环引用时的友好提示
        stack.push(taglib);

        // 先按标签名查找源文件
        let oTagFile = getTagFileOfPkg(taglib.pkg);
        if ( oTagFile[taglib.tag] ) {
            return oTagFile[taglib.tag];
        }

        // 再按标签别名查找所在包[taglib]配置的标签库，由该标签库递归找源文件
        let oPkg = bus.at('模块组件信息', taglib.pkg);
        let oPjtContext = bus.at('项目配置处理', oPkg.config);                                   // 解析项目配置文件
        let atastag = '@' + taglib.tag;
        let oTaglib = oPjtContext.result.oTaglibs[atastag];

        if ( oTaglib ) {
            if ( oTaglib.rposefile !== undefined ) return oTaglib.rposefile;

            let taglib;
            while ( (taglib = bus.at('标签库源文件', oTaglib, stack)) && !taglib.length && !taglib.rposefile ) {
                // 递归查找到底
            }
            if ( !taglib ) {
                oTaglib.rposefile = '';
            }else if ( taglib.length ) {
                oTaglib.rposefile = taglib;
            }else{
                oTaglib.rposefile = taglib.rposefile;
            }

        }else{
            oTaglib.rposefile = '';
        }

    // TODO
    !oTaglib.rposefile &&    console.info(stack.join('\n => '));

        return oTaglib.rposefile;
    });

    // 查找指定包中的全部源文件，建立标签关系
    function getTagFileOfPkg(pkg){
        let oTagFile;
        if ( !(oTagFile = rs[pkg]) ) {
            bus.at('自动安装', pkg);
            let oPkg = bus.at('模块组件信息', pkg);
            oTagFile = {};
            for ( let i=0,file,tag; file=oPkg.files[i++]; ) {
                tag = File.name(file).toLowerCase();
                oTagFile[tag] = file;                                                       // 标签 = 文件
                oTagFile['@'+tag] = file;                                                   // @标签 = 文件
            }
            rs[pkg] = oTagFile;
        }

        return oTagFile;
    }

})();
