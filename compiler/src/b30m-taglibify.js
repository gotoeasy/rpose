const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

(function(rs={}){

    // 按taglib找源文件
    bus.on('标签库源文件', (taglib, stack=[]) => {

        if (!taglib) return;

        // 循环引用时报异常
        let oSet = stack.oSet = stack.oSet || new Set();
        let refpkgtag = taglib.pkg + ':' + taglib.tag;
        if ( oSet.has(refpkgtag) ) {
            let msgs = [];
            stack.forEach(v => {
                msgs.push(v.taglib + ' (' + v.file + ')');
            });
            msgs.push(taglib.taglib + ' (' + taglib.file + ')');
            throw new Error('taglib component circular reference\n => ' + msgs.join('\n => '));
        }
        oSet.add(refpkgtag);

        stack.push(taglib);

        // 先按标签名查找源文件
        if ( taglib.pkg === '~' ) {
            if ( /^@/.test(taglib.tag) ) {
                if (taglib.astag === taglib.tag) {
                    taglib.tag = taglib.tag.substring(1);
                }
                return bus.at("标签库源文件", taglib); // 从指定模块查找
            }else{
                return bus.at('标签项目源文件', taglib.tag);    // 指所在工程的组件
            }
        }

        let oTagFile = getTagFileOfPkg(taglib.pkg);
        if ( oTagFile[taglib.tag] ) {
            return oTagFile[taglib.tag];
        }

        // 再按标签别名查找所在包[taglib]配置的标签库，由该标签库递归找源文件
        let oPkg = bus.at('模块组件信息', taglib.pkg);
        let oPjtContext = bus.at('项目配置处理', oPkg.config);                                   // 解析项目配置文件
        let atastag = '@' + taglib.tag;
        let oTaglib = oPjtContext.result.oTaglibs[atastag];

        let file = '';
        if ( oTaglib ) {
            let rst;
            while ( (rst = bus.at('标签库源文件', oTaglib, stack)) && (typeof rst !== 'string') ) {
                // 返回另一个标签库对象时，继续递归查找到底
                // 最终要么找到文件（返回文件绝对路径），要么找不到（返回‘’），要么异常（比如循环引用）
            }
            file = rst;
        }

        if ( !file ) {
            let msgs = [];
            stack.forEach(v => {
                msgs.push(v.taglib + ' (' + v.file + ')');
            });
            throw new Error('taglib component not found\n => ' + msgs.join('\n => '));
        }

        return file;

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
