const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 按标签库更换标签全名
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oPrjContext = bus.at("项目配置处理", context.input.file);        // 项目配置解析结果
        let oPrjTaglibs = oPrjContext.result.oTaglibs;                      // 项目[taglib]
        let oTaglibs = context.result.oTaglibs || {};                       // 组件[taglib]

        root.walk( 'Tag', (node, object) => {
            if ( object.standard ) return;
            
            let taglib = oTaglibs[object.value] || oPrjTaglibs[object.value];
            if ( taglib ){
                // 标签库中能找到的，按标签库更新为标签全名
                let srcFile;
                if ( taglib.pkg === '~' ) {
                    if ( /^@/.test(taglib.tag) ) {
                        if (taglib.astag === taglib.tag) {
                            taglib.tag = taglib.tag.substring(1);
                        }
                        srcFile = bus.at("标签库源文件", taglib); // 从指定模块查找
                    }else{
                        srcFile = bus.at('标签项目源文件', taglib.tag);    // 指所在工程的组件
                    }
                }else{
                    srcFile = bus.at("标签库源文件", taglib); // 从指定模块查找
                }

                if ( !srcFile ) {
                    throw new Err('component not found: ' + object.value, { ...context.input, ...object.pos });
                }

                object.value = bus.at('标签全名', srcFile);                     // 替换为标签全名，如 @scope/pkg:ui-btn
            }
            
        });
    
    }, {readonly: true});

}());

