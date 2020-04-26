const bus = require('@gotoeasy/bus');

// 当前项目文件时，返回'/'
bus.on('文件所在模块', function(){

    return file => {

        let pkg = '~', idx = file.lastIndexOf('/node_modules/');
        if ( idx > 0 ) {
            let ary = file.substring(idx + 14).split('/');                     
            if ( ary[0].startsWith('@') ) {
                pkg = ary[0] + '/' + ary[1];                           // xxx/node_modules/@aaa/bbb/xxxxxx => @aaa/bbb
            }else{
                pkg = ary[0];                                          // xxx/node_modules/aaa/bbb/xxxxxx => aaa
            }
        }

        return pkg;
    };

}());

