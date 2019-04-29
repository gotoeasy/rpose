const bus = require('@gotoeasy/bus');

bus.on('标签源文件', function(){

    // 【tag】
    //   -- 源文件
    //   -- nnn=@aaa/bbb:ui-xxx
    //   -- @aaa/bbb:ui-xxx
    //   -- bbb:ui-xxx
    //   -- ui-xxx
    return (tag) => {
        if ( tag.endsWith('.rpose') ) {
            return tag; // 已经是文件
        }
        
        if ( tag.indexOf(':') > 0 ) {
            // @taglib指定的标签
            let ary = tag.split(':');
            ary[0].indexOf('=') > 0 && (ary = ary[0].split('='))
            let oPkg = bus.at('模块组件信息', ary[0].trim());     // nnn=@aaa/bbb:ui-xxx => @aaa/bbb
            let files = oPkg.files;
            let name = '/' + ary[1] + '.rpose';
            for ( let i=0,srcfile; srcfile=files[i++]; ) {
                if ( srcfile.endsWith(name) ) {
                    return srcfile;
                }
            }

            return bus.at('标签库引用', tag, oPkg.config);

        }else{
            let file = bus.at('标签项目源文件', tag);             // 优先找文件名一致的源文件
            if ( file ) return file;

            let env = bus.at('编译环境');
            return bus.at('标签库引用', tag, env.path.root);      // 其次按标签库规则查找
        }

        // 找不到则undefined
    };

}());
