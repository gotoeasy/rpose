const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 处理 [taglib]
    // 和并组件[taglib]以及项目[taglib]成一个新副本存放于context.result.oTaglib
    // 名称重复时报错
    return postobject.plugin(__filename, function(root, context){

        let prj = bus.at('项目配置处理', context.input.file);
        let oTaglib = context.result.oTaglib = Object.assign({}, prj.oTaglib || {});        // 项目配置的[taglib]合并存放到组件范围缓存起来

        // 遍历树中的taglib节点，建库，处理完后删除该节点
        root.walk( 'RposeBlock', (node, object) => {

            if ( object.name.value !== 'taglib' ) return;
            if ( !object.text || !object.text.value || !object.text.value.trim() ) return;

            let oKv = bus.at('解析[taglib]', object.text.value, context, object.text.loc);

            for ( let k in oKv ) {
                if ( oTaglib[k] ) {
                    throw new Err('duplicate taglib name: ' + k, { file: context.input.file, text: context.input.text, line: object.text.loc.start.line, column: 1 });
                }
                oTaglib[k] = oKv[k];
//console.info('--------install taglib------------', `${k}=${oKv[k]}`)
                bus.at('标签库定义', `${k}=${oKv[k]}`, context.input.file)
            }

            node.remove();
            return false;
        });

    });

}());

