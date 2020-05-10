const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

bus.on('文件标签相应的源文件', function(oPkgSrc={}){

    // 【tag】
    //   -- 源文件
    //   -- nnn=@aaa/bbb:ui-xxx
    //   -- @aaa/bbb:ui-xxx
    //   -- bbb:ui-xxx
    //   -- ui-xxx
    //   -- @ui-xxx
    // 【oTaglibs】
    //   -- 标签所在组件的[taglib]配置
    return (tag, context) => {
        if ( tag.endsWith('.rpose') ) {
            return tag; // 已经是文件
        }
        
        if ( tag.indexOf(':') > 0 ) {
            // @taglib指定的标签
            let taglib = bus.at('解析taglib', tag);

            let env = bus.at('编译环境');
            if ( env.packageName === taglib.pkg ) {
                // 当前项目的包名和标签库包名一样时，从当前项目查找源文件
                // 比如，第三方包引用当前包，当前包作为项目修改时，让第三方包引用当前项目源文件
                return bus.at('标签源文件', taglib.tag);
            }

            return bus.at('标签库源文件', taglib);
        }

        // 看看是当前项目还是第三方模块包，查找方式有差异
        let pkg = bus.at('文件所在模块', context.input.file);

        // 当前项目
        if (pkg === '~') {
            let file = bus.at('标签源文件', tag, context.result.oTaglibs);
            if (!file && /^@/i.test(tag)) {
                file = bus.at('标签源文件', tag.substring(1), context.result.oTaglibs);
            }
            return file;
        }

        // 第三方模块包
        let oPrjContext = bus.at("项目配置处理", context.input.file);        // 项目配置解析结果
        let oPrjTaglibs = oPrjContext.result.oTaglibs;                      // 项目[taglib]
        let oTaglibs = context.result.oTaglibs || {};                       // 组件[taglib]
        let taglib = oPrjTaglibs[tag] || oTaglibs[tag];
        if (taglib) {
            // 有相应标签库定义时，按标签库方式查找
            return bus.at('标签库源文件', taglib);
        }else{
            let orgTag = /^@/i.test(tag) ? tag.substring(1) : tag;          // 默认@别名时去@
            taglib = oPrjTaglibs[orgTag] || oTaglibs[orgTag];
            if (taglib) {
                return bus.at('标签库源文件', taglib);                      // 有相应标签库定义时，按标签库方式查找
            }

            // 标签库没找到时直接按标签名找源文件
            let oSrcFiles = oPkgSrc[oPrjContext.path.root];                 // 缓存
            if (!oSrcFiles) {
                oSrcFiles = {};
                let srcFiles = File.files(oPrjContext.path.src, '**.rpose');
                srcFiles.forEach(f => {
                    oSrcFiles[File.name(f).toLowerCase()] = f;
                });
                oPkgSrc[oPrjContext.path.root] = oSrcFiles;
            }
            return oSrcFiles[orgTag];
        }

    };

}());


bus.on('标签源文件', function(){

    // 【tag】
    //   -- 源文件
    //   -- nnn=@aaa/bbb:ui-xxx
    //   -- @aaa/bbb:ui-xxx
    //   -- bbb:ui-xxx
    //   -- ui-xxx
    //   -- @ui-xxx
    // 【oTaglibs】
    //   -- 标签所在组件的[taglib]配置
    return (tag, oTaglibs={}) => {
        if ( tag.endsWith('.rpose') ) {
            return tag; // 已经是文件
        }
        
        if ( tag.indexOf(':') > 0 ) {
            // @taglib指定的标签
            let taglib = bus.at('解析taglib', tag);

            let env = bus.at('编译环境');
            if ( env.packageName === taglib.pkg ) {
                // 当前项目的包名和标签库包名一样时，从当前项目查找源文件
                // 比如，第三方包引用当前包，当前包作为项目修改时，让第三方包引用当前项目源文件
                return bus.at('标签源文件', taglib.tag);
            }

            return bus.at('标签库源文件', taglib);
        }else{
            // 优先查找项目源文件
            let file = bus.at('标签项目源文件', tag);
            if ( file ) return file;

            // 其次查找组件标签库
            let alias = tag.startsWith('@') ? tag : ('@' + tag);
            if ( oTaglibs[alias] ) {
                return bus.at('标签库源文件', oTaglibs[alias]);
            }

            // 最后查找项目标签库
            let env = bus.at('编译环境');
            let oPjtContext = bus.at('项目配置处理', env.path.root + '/rpose.config.btf');
            if ( oPjtContext.result.oTaglibs[alias] ) {
                return bus.at('标签库源文件', oPjtContext.result.oTaglibs[alias]);
            }

            // 找不到
            return null;
        }
    };

}());
