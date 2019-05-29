const bus = require('@gotoeasy/bus');

bus.on('文件所在项目配置文件', function(){

    return file => {

        let btfFile, idx = file.lastIndexOf('/node_modules/');
        if ( idx > 0 ) {
            let rs = [];
            rs.push(file.substring(0, idx + 13))                        // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules
            let ary = file.substring(idx + 14).split('/');                     
            if ( ary[0].startsWith('@') ) {
                rs.push(ary[0]);                                        // xxx/node_modules/@aaa/bbb/xxxxxx => @aaa
                rs.push(ary[1]);                                        // xxx/node_modules/@aaa/bbb/xxxxxx => bbb
            }else{
                rs.push(ary[0]);                                        // xxx/node_modules/aaa/bbb/xxxxxx => aaa
            }
            rs.push('rpose.config.btf');

            btfFile = rs.join('/');                                    // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules/@aaa/bbb/rpose.config.btf
        }else{
            let env = bus.at('编译环境');
            btfFile = env.path.root + '/rpose.config.btf';
        }

        // 只管返回配置文件路径，不管该文件是否存在
        return btfFile;
    };

}());

