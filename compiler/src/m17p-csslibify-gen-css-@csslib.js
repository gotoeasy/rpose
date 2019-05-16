const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const findNodeModules = require('find-node-modules');

bus.on('编译插件', function(){
    
    // 含@csslib的标签，按需查询引用样式库
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oPrjContext = bus.at("项目配置处理", context.input.file);
        let oPrjCsslibs = oPrjContext.result.oCsslibs;                                                  // 项目[csslib]配置的样式库 (asname：lib)
        let oCsslibs = context.result.oCsslibs;                                                         // 组件[csslib]配置的样式库 (asname：lib)
        let oAtCsslibPkgs = context.result.oAtCsslibPkgs = context.result.oAtCsslibPkgs || {};          // 组件@csslib配置的样式库【别名-包名】映射关系
        let oAtCsslibs = context.result.oAtCsslibs = context.result.oAtCsslibs || {};                   // 组件@csslib配置的样式库 (asname：lib)

        let atcsslibtagcss = context.result.atcsslibtagcss = context.result.atcsslibtagcss || [];       // @csslib的标准标签样式

        let hashClassName = bus.on('哈希样式类名')[0];
        let rename = (pkg, cls) => hashClassName(context.input.file, cls+ '@' + pkg);                   // 自定义改名函数(总是加@)
        let strict = true;                                                                              // 样式库严格匹配模式

        root.walk( 'Class', (node, object) => {

            // 查找@csslib属性节点，@csslib仅作用于当前所在标签，汇总当前标签和样式类，用当前样式库按严格匹配模式一次性取出
            let atcsslibNode, querys = [];
            for ( let i=0,nd; nd=node.parent.nodes[i++]; ) {
                if ( nd.type === '@csslib' ) {
                    atcsslibNode = nd;
                    break;  // 找到
                }
            }


            if ( atcsslibNode ) {
                // ==============================================================================
                // 当前节点有class、有@csslib
                // ==============================================================================

                // ---------------------------------
                // 检查@csslib属性值
                if ( bus.at('是否表达式', object.value) ) {
                    // @csslib属性值不能使用表达式
                    throw new Err('unsupport expression on @csslib', {file: context.input.file, text: context.input.text, start: atcsslibNode.object.loc.start.pos, end: atcsslibNode.object.loc.end.pos});
                }

                // ---------------------------------
                // 解析@csslib
                let csslib = bus.at('解析csslib', atcsslibNode.object.value, context.input.file);
                if ( !csslib ) {
                    // 无效的@csslib格式
                    throw new Err('invalid @csslib value', {file:context.input.file, text:context.input.text, start: atcsslibNode.object.loc.start.pos, end: atcsslibNode.object.loc.end.pos});
                }

                // ---------------------------------
                // 保存@csslib位置以备用
                csslib.pos = {start: atcsslibNode.object.loc.start.pos, end: atcsslibNode.object.loc.end.pos};

                // ---------------------------------
                // 检查别名冲突
                if ( oAtCsslibs[csslib.alias] ) {
                    // 不能和组件内的其他@csslib有别名冲突 （冲突将导致js代码中的样式库类名困惑，无法判断进行正确的哈希改名）
                    throw new Err('unsupport mutil @csslib with alias [*]', { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                }
                if ( oCsslibs[csslib.alias] ) {
                    // 不能和组件[csslib]有别名冲突
                    throw new Err('duplicate csslib name [*]', { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                }
                if ( oPrjCsslibs[csslib.alias] ) {
                    // 不能和项目[csslib]有别名冲突
                    throw new Err('duplicate csslib name [*]', { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                }

                // ---------------------------------
                // 设定目标目录的绝对路径
                let dir;
                if ( csslib.pkg.startsWith('~') ) {
                    // 如果是目录，检查目录是否存在
                    let root = bus.at('文件所在项目根目录', context.input.file);
                    dir = csslib.pkg.replace(/\\/g, '/').replace(/^~\/*/, root + '/');
                    if ( !File.existsDir(dir) ) {
                        throw new Err('folder not found [' + dir + ']', { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                    }
                }else{
                    // 自动安装
                    if ( !bus.at('自动安装', csslib.pkg) ) {
                        throw new Err('package install failed: ' + csslib.pkg, { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                    }
                    
                    dir = getNodeModulePath(csslib.pkg);
                    if ( !dir ) {
                        // 要么安装失败，或又被删除，总之不应该找不到安装位置
                        throw new Err('package install path not found: ' + csslib.pkg, { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                    }
                }
                csslib.dir = dir;                                                                       // 待导入的样式文件存放目录

                // ---------------------------------
                // 创建@csslib样式库
                let atcsslib = bus.at('样式库', csslib);
                oAtCsslibs[csslib.alias] = atcsslib;                                                    // 存起来备查
                oAtCsslibPkgs[csslib.alias] = atcsslib.pkg;                                             // 保存样式库匿名关系，用于脚本类名转换

                // ---------------------------------
                // 保存当前标准标签名，便于@csslib查询样式库
                node.parent.object.standard && querys.push(node.parent.object.value);                   // 标准标签名

                // ---------------------------------
                // 检查当前标签的样式类
                for ( let i=0,ary,clspkg,clsname,atname; clspkg=object.classes[i++]; ) {
                    ary = clspkg.split('@');
                    clsname = '.' + ary[0];                                                             // 类名
                    atname = ary.length > 1 ? ary[1] : '*';                                             // 库别名

                    if ( csslib.alias === atname ) {
                        // 属于@csslib样式
                        querys.push(clsname);                                                           // 匹配当前@csslib样式库

                        if ( atname === "*" && atcsslib.has(clsname) ) {
                            // 【重要】存起来，后面哈希类名使用
                            (object.atcsslibx = object.atcsslibx || []).push(ary[0]);                   // 当前节点使用了@csslib=*的样式名
                        }

                        if ( atname !== '*' && !atcsslib.has(clsname) ) {
                            // 按宽松模式检查样式库是否有指定样式类，没有则报错
                            throw new Err(`css class "${clsname}" not found in csslib "${csslib.pkg}"`, {file:context.input.file, text:context.input.text, start: csslib.pos.start, end: csslib.pos.end});
                        }
                    }else if ( oCsslibs[atname] ) {
                        // 属于组件[csslib]样式
                        let oCsslib = oCsslibs[atname];
                        if ( !oCsslib.has(clsname) ) {
                            // 按宽松模式检查样式库是否有指定样式类，没有则报错
                            throw new Err(`css class "${clsname}" not found in csslib "${atname}"`, {file:context.input.file, text:context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                        }
                    }else if ( oPrjCsslibs[atname] ) {
                        // 属于项目[csslib]样式
                        let oCsslib = oPrjCsslibs[atname];
                        if ( !oCsslib.has(clsname) ) {
                            // 按宽松模式检查样式库是否有指定样式类，没有则报错
                            throw new Err(`css class "${clsname}" not found in csslib "${atname}"`, {file:context.input.file, text:context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                        }
                    }else{
                        // 有@别名后缀，但在@csslib、组件[csslib]、项目[csslib]中都找不到相应的样式库配置
                        if ( atname !== '*' ) {
                            throw new Err(`undefined csslib "${atname}" of "${clspkg}"`, {file:context.input.file, text:context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                        }
                    }
                }

                querys.length && atcsslibtagcss.push( atcsslib.get(...querys, {rename, strict}) );      // 用当前样式库一次性查取

                atcsslibNode.remove();                                                                  // @csslib的样式已生成，该节点删除

            }else{
                // ==============================================================================
                // 当前节点有class，但没有@csslib，做class的样式库别名检查 （理应分离检查，暂且先这样）
                // ==============================================================================

                // ---------------------------------
                // 检查当前标签的样式类
                for ( let i=0,ary,clspkg,clsname,atname; clspkg=object.classes[i++]; ) {
                    ary = clspkg.split('@');
                    clsname = '.' + ary[0];                                                             // 类名
                    atname = ary.length > 1 ? ary[1] : '*';                                             // 库别名

                    if ( oCsslibs[atname] ) {
                        // 属于组件[csslib]样式
                        let oCsslib = oCsslibs[atname];
                        if ( !oCsslib.has(clsname) ) {
                            // 按宽松模式检查样式库是否有指定样式类，没有则报错
                            throw new Err(`css class "${clsname}" not found in csslib "${atname}"`, {file:context.input.file, text:context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                        }
                    }else if ( oPrjCsslibs[atname] ) {
                        // 属于项目[csslib]样式
                        let oCsslib = oPrjCsslibs[atname];
                        if ( !oCsslib.has(clsname) ) {
                            // 按宽松模式检查样式库是否有指定样式类，没有则报错
                            throw new Err(`css class "${clsname}" not found in csslib "${atname}"`, {file:context.input.file, text:context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                        }
                    }else{
                        // 有@别名后缀，但无@csslib、且在组件[csslib]、项目[csslib]中都找不到相应的样式库配置
                        if ( atname !== '*' ) {
                            throw new Err(`undefined csslib "${atname}" of "${clspkg}"`, {file:context.input.file, text:context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                        }
                    }
                }

            
            }


        });
    
    });

}());

// 找不到时返回undefined
function getNodeModulePath(npmpkg){
    let node_modules = [...findNodeModules({ cwd: process.cwd(), relative: false }), ...findNodeModules({ cwd: __dirname, relative: false })];
    for ( let i=0,modulepath,dir; modulepath=node_modules[i++]; ) {
        dir = File.resolve(modulepath, npmpkg);
        if ( File.existsDir(dir) ) {
            return dir;
        }
    }
}
