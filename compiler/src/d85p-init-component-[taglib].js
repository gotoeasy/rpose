const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 [taglib]
    // 和并组件[taglib]以及项目[taglib]成一个新副本存放于context.result.oTaglib
    // 名称重复时报错
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let prj = bus.at('项目配置处理', context.input.file);
        let oTaglib = context.result.oTaglib = Object.assign({}, prj.oTaglib || {});        // 项目配置的[taglib]合并存放到组件范围缓存起来

        // 遍历树中的taglib节点，建库，处理完后删除该节点
        root.walk( 'RposeBlock', (node, object) => {

            if ( object.name.value !== 'taglib' ) return;
            if ( !object.text || !object.text.value || !object.text.value.trim() ) return;

            let oKv = bus.at('解析[taglib]', object.text.value, context, object.text.loc);

            // 与项目配置的重复性冲突检查
            for ( let k in oKv ) {
                if ( oTaglib[k] ) {
                    throw new Err('duplicate taglib name: ' + k, { file: context.input.file, text: context.input.text, line: object.text.loc.start.line + oTaglib[k].line - 1 });
                }
            }


            // 检查安装依赖包
            let mapPkg = new Map();
            for ( let key in oKv ) {
                mapPkg.set(oKv[key].pkg, oKv[key]);
            }
            mapPkg.forEach((oTag, pkg) => {
                if ( !bus.at('自动安装', pkg) ) {
                    throw new Err('package install failed: ' + pkg, { file: context.input.file, text: context.input.text, line: object.text.loc.start.line + oTag.line - 1 });
                }
            });

            // 逐个定义标签库关联实际文件
            for ( let key in oKv ) {
                try{
                    bus.at('标签库定义', oKv[key].taglib, context.input.file);  // 无法关联时抛出异常
                }catch(e){
                    throw new Err.cat(e, { file: context.input.file, text: context.input.text, line: object.text.loc.start.line + oKv[key].line - 1 });
                }
            }

            node.remove();
            return false;
        });



//console.info('-------rs----------', context.input.file, bus.at('标签库定义', '', context.input.file))
    });

}());
