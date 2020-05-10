const bus = require('@gotoeasy/bus');

bus.on('组件类名', function(){

    return file => {
        let tagpkg = bus.at('标签全名', bus.at('标签源文件', file));                                             // xxx/node_modules/@aaa/bbb/ui-abc.rpose => @aaa/bbb:ui-abc
        tagpkg = tagpkg.replace(/[@/`]/g, '$').replace(/\./g, '_').replace(':', '$-');                          // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc
        tagpkg = ('-'+tagpkg).split('-').map( s => s.substring(0,1).toUpperCase()+s.substring(1) ).join('');    // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc => $aaa$bbb$UiAbc

        if (/^(date|object|function)$/i.test(tagpkg)){
            tagpkg = tagpkg + '_';                                                                              // 特殊类名转换一下避免冲突
        }

        return tagpkg;
    };

}());

