const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');

bus.on('编译插件', function(){
    
	return postobject.plugin(__filename, function(root, context){

        let style = context.style;

        // 解决样式中URL资源的复制及改名问题
        root.walk( 'RposeBlock', (node, object) => {

            // 编译结果追加到context中以便于读取，节点相应删除
            if ( /^css$/.test(object.name.value) ) {
                let css = object.text ? object.text.value : '';
                if ( css ) {
                    let theme = bus.at('样式风格');
                    style.css = theme.css + css;
                }                

                node.remove();
                return false;
            }
        });

        if ( !style.css ) return;

        let env = bus.at('编译环境');
	    let fromPath = File.path(context.input.file);
        let toPath = env.path.build_temp + '/' + bus.at('组件目标文件名', context.input.file) + '.css';	// 假定组件都编译到%build_temp%目录
        let assetsPath = File.relative(toPath, env.path.build_dist + '/images');			            // 图片统一复制到%build_dist%/images，按生成的css文件存放目录决定url相对路径

        style.css = bus.at('样式统一化整理', style.css, fromPath, toPath, assetsPath);
    });

}());

