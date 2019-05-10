const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 针对含@taglib的标签，把标签名替换为标签全名
    // @taglib不能用于标准标签，不能用于项目实际存在的组件，不能用于特殊的内置标签，否则报错
    // 完成后删除@taglib节点
    return postobject.plugin(/**/__filename/**/, function(root, context){

        root.walk( '@taglib', (node, object) => {

            // 父节点
            let tagNode = node.parent;
            if ( tagNode.object.standard ) {
                throw new Err('unsupport @taglib on standard tag', { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let tagName = tagNode.object.value;                                 // 标签名
            if ( !tagName.startsWith('@') ) {
                // 标签名如果没有使用@前缀，要检查是否已存在有组件文件，有则报错
                let cpFile = bus.at('标签项目源文件', tagNode.object.value);    // 当前项目范围内查找标签对应的源文件
                if ( cpFile ) {
                    throw new Err(`unsupport @taglib on existed component: ${tagNode.object.value}(${cpFile})`, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
                }
            }
            

            let pkg, comp, match, taglib = object.value;

            if ( (match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*:\s*(.+?)\s*$/)) ) {
                // @taglib = "name=@scope/pkg:component"
                pkg = match[1];
                comp = match[2];
            }else if ( (match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*$/)) ) {
                // @taglib = "name=@scope/pkg"
                pkg = match[1];
                comp = tagName;
            }else if ( taglib.indexOf('=') >= 0 ) {
                // @taglib = "=@scope/pkg"
                throw new Err('invalid attribute value of @taglib', { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }else if ( (match = taglib.match(/^\s*(.+?)\s*:\s*(.+?)\s*$/)) ) {
                // @taglib = "@scope/pkg:component"
                pkg = match[1];
                comp = match[2];
            }else if ( (match = taglib.match(/^\s*(.+?)\s*$/)) ) {
                // @taglib = "@scope/pkg"
                pkg = match[1];
                comp = tagName;
            }else {
                throw new Err('invalid attribute value of @taglib', { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            comp.startsWith('@') && (comp = comp.substring(1));                 // 去除组件名的@前缀

            let install = bus.at('自动安装', pkg);
            if ( !install ) {
                throw new Err('package install failed: ' + pkg, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let oPkg = bus.at('模块组件信息', pkg);

            try{
                bus.at('标签库定义', `${pkg}:${comp}`, oPkg.config);
            }catch(e){
                throw new Err('taglib setup failed\n' + e.message, e, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let srcFile = bus.at('标签库引用', `${pkg}:${comp}`, oPkg.config);  // 从指定模块查找
            if ( !srcFile ) {
                throw new Err('component not found: ' + object.value, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let tagpkg = bus.at('标签全名', srcFile);

            tagNode.object.value = tagpkg;                                      // 替换为标签全名，如 @scope/pkg:ui-btn
            node.remove();
        });
    
    });

}());

