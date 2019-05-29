const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');

bus.on('标签全名', function(){

    return file => {
        
        if ( !/\.rpose$/i.test(file) && file.indexOf(':') > 0 ) {
            return file; // 已经是全名标签
        }

        let tagpkg = '';
        let idx = file.lastIndexOf('/node_modules/');
        if ( idx > 0 ) {
            let ary = file.substring(idx + 14).split('/');                          // xxx/node_modules/@aaa/bbb/xxxxxx => [@aaa, bbb, xxxxxx]
            if ( ary[0].startsWith('@') ) {
                tagpkg = ary[0] + '/' + ary[1] + ':' + File.name(file);             // xxx/node_modules/@aaa/bbb/xxxxxx/abc.rpose => @aaa/bbb:abc
            }else{
                tagpkg = ary[0] + ':' + File.name(file);                            // xxx/node_modules/aaa/xxxxxx/abc.rpose => aaa:abc
            }
        }else{
            tagpkg = File.name(file);                                               // aaa/bbb/xxxxxx/abc.rpose => abc      ui-btn => ui-btn

            // 内置标签
            tagpkg === 'router' && (tagpkg = '@rpose/buildin:router');
            tagpkg === 'router-link' && (tagpkg = '@rpose/buildin:router-link');
        }

        return tagpkg;
    };

}());
