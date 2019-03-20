const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 针对含@taglib的标签，把标签名替换为标签全名
    // @taglib不能用于标准标签，不能用于项目实际存在的组件，不能用于特殊的内置标签，否则报错
    // 完成后删除@taglib节点
    return postobject.plugin(__filename, function(root, context){

        root.walk( '@taglib', (node, object) => {

            // 父节点
            let tagNode = node.parent;
            if ( tagNode.object.standard ) {
                throw new Err('unsupport @taglib on standard tag', { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let cpFile = getComponentFileOfProject(tagNode.object.value);
            if ( cpFile ) {
                throw new Err(`unsupport @taglib on existed component: ${tagNode.object.value}(${cpFile})`, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }
            

            let name, pkg, comp, match, taglib = object.value;

            if ( (match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*:\s*(.+?)\s*$/)) ) {
                // @taglib = "name=@scope/pkg:component"
                pkg = match[1];
                comp = match[2];
            }else if ( (match = taglib.match(/^\s*.+?\s*=\s*(.+?)\s*$/)) ) {
                // @taglib = "name=@scope/pkg"
                pkg = match[1];
                comp = tagNode.object.value;
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
                comp = tagNode.object.value;
            }else {
                throw new Err('invalid attribute value of @taglib', { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }


            let oPkg = bus.at('模块组件信息', pkg);
            let srcFile = bus.at('标签库引用', `${pkg}:${comp}`, oPkg.config);  // 从指定模块查找
            if ( !srcFile ) {
                throw new Err('component not found: ' + object.value, { file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos });
            }

            let tagpkg = bus.at('标签全名', srcFile);

            tagNode.object.value = tagpkg;                     // 替换为标签全名，如 @scope/pkg:ui-btn
            node.remove();
        });
    
    });

}());


function getComponentFileOfProject(tag){
    // TODO 性能改善
    let files = bus.at('源文件清单');
    let name = '/' + tag + '.rpose';
    for ( let i=0,file; file=files[i++]; ) {
        if ( file.endsWith(name) ) {
            let env = bus.at('编译环境');
            return file.replace(env.path.root + '/', '');
        }
    }
}
