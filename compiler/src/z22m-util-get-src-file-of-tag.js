const bus = require('@gotoeasy/bus');

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
