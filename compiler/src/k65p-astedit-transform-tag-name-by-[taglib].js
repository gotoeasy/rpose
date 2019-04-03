const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 按需查询引用样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oTaglib = Object.assign({}, context.result.oTaglib);                        // 复制(项目[taglib]+组件[taglib])


        let ary, clsname, csslib, css;
        root.walk( 'Tag', (node, object) => {
            if ( object.standard ) return;
            
            let taglib = oTaglib[object.value]
            if ( !taglib ) return;

            let pkg, comp, ary = taglib.split(':');
            if ( ary.length > 1 ) {
                pkg = ary[0].trim();
                comp = ary[1].trim();
            }else{
                pkg = taglib.trim();
                comp = object.value;
            }

            let install = bus.at('自动安装', pkg);
            if ( !install ) {
                throw new Err('package install failed: ' + pkg, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let oPkg = bus.at('模块组件信息', pkg);
            let srcFile = bus.at('标签库引用', `${pkg}:${comp}`, oPkg.config);  // 从指定模块查找
            if ( !srcFile ) {
                throw new Err('component not found: ' + object.value, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let tagpkg = bus.at('标签全名', srcFile);

            object.value = tagpkg;                     // 替换为标签全名，如 @scope/pkg:ui-btn
            
        });
    
    }, {readonly: true});

}());

