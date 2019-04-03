const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 组件配置[csslib]
    // 检查安装建立组件样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let prj = bus.at('项目配置处理', context.input.file);
        let oCsslib = context.result.oCsslib = Object.assign({}, prj.oCsslib || {});        // 项目配置的[csslib]合并存放到组件范围缓存起来

        // 遍历树中的csslib节点，建库，处理完后删除该节点
        root.walk( 'RposeBlock', (node, object) => {

            if ( object.name.value !== 'csslib' ) return;
            if ( !object.text || !object.text.value || !object.text.value.trim() ) return;

            let oKv = bus.at('解析[csslib]', object.text.value, context, object.text.loc);

            for ( let k in oKv ) {
                if ( oCsslib[k] ) {
                    throw new Err('duplicate csslib name: ' + k, { file: context.input.file, text: context.input.text, line: object.text.loc.start.line, column: 1 });
                }
                oCsslib[k] = bus.at('样式库', k, oKv[k]);
            }

            node.remove();
            return false;
        });
   
    });

}());

