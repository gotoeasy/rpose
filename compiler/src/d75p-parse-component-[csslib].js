const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 组件配置[csslib]
    // 检查安装建立组件样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oPrjContext = bus.at("项目配置处理", context.input.file);
        let oPrjCsslibs = oPrjContext.result.oCsslibs;                                      // 存放项目配置的样式库对象
        let oCsslibs = context.result.oCsslibs = context.result.oCsslibs || {};             // 存放组件配置的样式库对象
        let oCsslibPkgs = context.result.oCsslibPkgs = context.result.oCsslibPkgs || {};    // 存放组件配置的样式库【别名-包名】映射关系

        // 遍历树中的csslib节点，建库，处理完后删除该节点
        root.walk( 'RposeBlock', (node, object) => {

            if ( object.name.value !== 'csslib' ) return;
            if ( !object.text || !object.text.value || !object.text.value.trim() ) return;

            let oLibs = bus.at('解析[csslib]', object.text, context.input.file, context.input.text);

            let csslib, oCsslib;
            for ( let alias in oLibs ) {
                csslib = oLibs[alias];

                // 与项目配置的重复性冲突检查
                if ( oPrjCsslibs[alias] ) {
                    throw new Err('duplicate csslib name: ' + alias, { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                }

                oCsslib = bus.at('样式库', csslib);                 // 转换为样式库对象
                oCsslibs[alias] = oCsslib;                          // 存放样式库对象
                oCsslibPkgs[alias] = oCsslib.pkg;                   // 存放样式库【别名-包名】映射关系（包名不一定是csslib.pkg）
            }

            node.remove();
            return false;
        });

    });

}());
