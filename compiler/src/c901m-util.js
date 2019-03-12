const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');

bus.on('标签全名', function(){

    return file => {

        if ( file.endsWith('```.rpose') ) {
            return '$BuildIn$_' + hash(File.name(file));  // 内置的【```.rpose】特殊处理
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
            tagpkg = File.name(file);                                               // aaa/bbb/xxxxxx/abc.rpose => abc
        }

        return tagpkg;
    };

}());

bus.on('标签源文件', function(){

    return tag => {
        if ( tag.endsWith('.rpose') ) {
            return tag; // 已经是文件
        }
        
        if ( tag.indexOf(':') > 0 ) {
            // @taglib指定的标签
            let ary = tag.split(':');
            let oPkg = bus.at('模块组件信息', ary[0]);
            let files = oPkg.files;
            let name = '/' + ary[1] + '.rpose';
            for ( let i=0,file; file=files[i++]; ) {
                if ( file.endsWith(name) ) {
                    return file;
                }
            }

        }else{
            let files = bus.at('源文件清单');
            let name = '/' + tag + '.rpose';
            for ( let i=0,file; file=files[i++]; ) {
                if ( file.endsWith(name) ) {
                    return file;
                }
            }
        }
    };

}());

bus.on('组件类名', function(){

    return file => {
        let tagpkg = bus.at('标签全名', file);                                                                   // xxx/node_modules/@aaa/bbb/ui-abc.rpose => @aaa/bbb:ui-abc
        tagpkg = tagpkg.replace(/[@\/]/g, '$').replace(/\./g, '_').replace(':', '$-');                          // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc
        tagpkg = ('-'+tagpkg).split('-').map( s => s.substring(0,1).toUpperCase()+s.substring(1) ).join('');    // @aaa/bbb:ui-abc => $aaa$bbb$-ui-abc => $aaa$bbb$UiAbc
        return tagpkg;
    };

}());


bus.on('组件目标文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        if ( srcFile.startsWith(env.path.src_buildin) ) {
            return '$buildin/' + File.name(srcFile);  // buildin
        }

        let tagpkg = bus.at('标签全名', srcFile);   // @aaa/bbb:ui-btn
        return tagpkg.replace(':', '/');
    };

}());


bus.on('页面目标JS文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.js'; 
    };

}());

bus.on('页面目标CSS文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.css'; 
    };

}());

bus.on('页面目标HTML文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.html'; 
    };

}());
