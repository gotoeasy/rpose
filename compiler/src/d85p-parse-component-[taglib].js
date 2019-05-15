const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 [taglib]
    // 名称重复时报错
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oPrjContext = bus.at("项目配置处理", context.input.file);                // 项目配置解析结果
        let oPrjTaglibs = oPrjContext.result.oTaglibs;                              // 项目[taglib]

        // 遍历树中的taglib节点，建库，处理完后删除该节点
        root.walk( 'RposeBlock', (node, object) => {

            if ( object.name.value !== 'taglib' ) return;

            let oTaglibs = bus.at('解析[taglib]', object.text, context.input.file);

            // 安装、检查标签库定义
            let taglib;
            for ( let alias in oTaglibs ) {
                taglib = oTaglibs[alias];
                // 与项目配置的重复性冲突检查
                if ( oPrjTaglibs[alias] ) {
                    throw new Err('duplicate taglib alias: ' + alias, { file: context.input.file, text: context.input.text, start: taglib.pos.start, end: taglib.pos.end });
                }

                if ( !bus.at('自动安装', taglib.pkg) ) {
                    throw new Err('package install failed: ' + taglib.pkg, { file: context.input.file, text: context.input.text, start: taglib.pos.start, end: taglib.pos.end });
                }

                try{
                    bus.at('标签库源文件', taglib);
                }catch(e){
                    throw new Err(e.message, e, { file: context.input.file, text: context.input.text, start: taglib.pos.start, end: taglib.pos.end });
                }

            }

            context.result.oTaglibs = oTaglibs;

            node.remove();
            return false;
        });


    });

}());
