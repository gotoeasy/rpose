const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const csso = require('csso');

bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let env  = bus.at('编译环境');
        let allreferences = context.result.allreferences;

        let ary = [];
        allreferences.forEach(tagpkg => {
            //let ctx = bus.at('编译组件', tagpkg);
            let ctx = bus.at('组件编译缓存', bus.at('标签源文件', tagpkg));
            if ( !ctx ) {
                ctx = bus.at('编译组件', tagpkg);
            }
            ctx.result.css && ary.push(ctx.result.css);
        });

        context.result.css = ary.join('\n');
        context.result.css = csso.minify( ary.join('\n'), {forceMediaMerge: true} ).css;

        context.result.promiseCss = bus.at('编译页面CSS', context.result.css, context.input.file);
    });

}());



bus.on('编译页面CSS', function(){

	// srcFile定位编译前的css文件位置
	return async function(inputCss, srcFile){
		try{
			let env = bus.at('编译环境');

			// TODO 友好的出错信息提示
			let from = env.path.build_temp + '/' + bus.at('标签全名', srcFile) + '.css';	    // 页面由组件拼装，组件都在%build_temp%目录
			let to = env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.css';
			let assetsPath = File.relative(to, env.path.build_dist + '/images');			// 图片统一复制到%build_dist%/images，按生成的css文件存放目录决定url相对路径
			
			let rs;
			let opt = {from, to, assetsPath,
				normalize: true,
				removeComments: true
			};

            let css;
			if ( env.release ) {
				rs = await csjs.miniCss(inputCss, opt);
                css = csso.minify( rs.css, {forceMediaMerge: true} ).css;
			}else{
				rs = await csjs.formatCss(csso.minify( inputCss, {forceMediaMerge: true} ).css, opt);
                css = rs.css;
			}

			return css;
		}catch(e){
			throw Err.cat('compile page css failed', srcFile, e);
		}
	};

}());
