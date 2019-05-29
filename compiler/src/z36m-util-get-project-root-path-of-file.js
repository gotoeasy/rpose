const bus = require('@gotoeasy/bus');

bus.on('文件所在项目根目录', function(){

    return file => {

        let dir, idx = file.lastIndexOf('/node_modules/');
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

            dir = rs.join('/');                                         // xxx/node_modules/@aaa/bbb/xxxxxx => xxx/node_modules/@aaa/bbb
        }else{
            let env = bus.at('编译环境');
            dir = env.path.root;
        }

        return dir;
    };

}());
