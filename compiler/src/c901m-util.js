const File = require('@gotoeasy/file');
const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');

bus.on('标签全名', function(){

	return file => {

		if ( file.endsWith('```.rpose') ) {
			return '$BuildIn$_' + hash(File.name(file));  // 内置的【```.rpose】特殊处理
		}

        let tagpkg = '';
        let idx = file.indexOf('/node_modules/');
        if ( idx > 0 ) {
            let tmp = file.substring(idx + 14);                                     // xxx/node_modules/@aaa/bbb/xxxxxx => @aaa/bbb/xxxxxx
            let npmpkg;
            if ( tmp.startsWith('@') ) {
                npmpkg = tmp.substring(0, tmp.indexOf('/', tmp.indexOf('/')+1));    // @aaa/bbb/xxxxxx => @aaa/bbb
            }else{
                npmpkg = tmp.substring(0, tmp.indexOf('/'));                        // bbb/xxxxxx => bbb
            }
            tagpkg = npmpkg + ':' + File.name(file);
        }else{
            tagpkg = File.name(file);
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
        let tagpkg = bus.at('标签全名', file);  // xxx/node_modules/@aaa/bbb/ui-abc.rpose => @aaa/bbb:ui-abc
        tagpkg = tagpkg.replace(/[@\/]/g, '$').replace(/\./g, '_').replace(':', '__-');     // @aaa/bbb:ui-abc => $aaa$bbb__-ui-abc
		tagpkg = ('-'+tagpkg).split('-').map( s => s.substring(0,1).toUpperCase()+s.substring(1) ).join('');  // @abc/def-gh.xyz@1.2.3 => $abc_DefGh_xyz$1_2_3
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
