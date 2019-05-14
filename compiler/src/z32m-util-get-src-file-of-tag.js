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
