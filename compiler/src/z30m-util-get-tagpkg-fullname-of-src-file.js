const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');

bus.on('标签全名', function(){

    return file => {
        
        let idx = file.indexOf(':');
        if ( idx > 0 && file.substring(idx).indexOf('.') < 0 ) {
            return file; // 已经是全名标签
        }

        let tagpkg = '';
        idx = file.lastIndexOf('/node_modules/');
        if ( idx > 0 ) {
            let ary = file.substring(idx + 14).split('/');                          // xxx/node_modules/@aaa/bbb/xxxxxx => [@aaa, bbb, xxxxxx]
            if ( ary[0].startsWith('@') ) {
                tagpkg = ary[0] + '/' + ary[1] + ':' + File.name(file);             // xxx/node_modules/@aaa/bbb/xxxxxx/abc.rpose => @aaa/bbb:abc
            }else{
                tagpkg = ary[0] + ':' + File.name(file);                            // xxx/node_modules/aaa/xxxxxx/abc.rpose => aaa:abc
            }
        }else{
            tagpkg = File.name(file);                                               // aaa/bbb/xxxxxx/abc.rpose => abc      ui-btn => ui-btn
        }

        return tagpkg;
    };

}());
