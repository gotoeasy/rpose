const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const findNodeModules = require('find-node-modules');

const Alias = 'DEFAULT_ALIAS_AUTO_ADD';

bus.on('编译插件', function(){
    
    // 检查样式类名和样式库是否匹配
    // 如果匹配的是无名样式库，自动添加别名，便于后续查询样式
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let oPrjContext = bus.at("项目配置处理", context.input.file);
        let oPrjCsslibs = oPrjContext.result.oCsslibs;                                                  // 项目[csslib]配置的样式库 (asname：lib)
        let oCsslibPkgs = context.result.oCsslibPkgs;                                                   // 组件[csslib]配置的样式库【别名-包名】映射关系
        let oCsslibs = context.result.oCsslibs;                                                         // 组件[csslib]配置的样式库 (asname：lib)
        let oAtCsslibPkgs = context.result.oAtCsslibPkgs = context.result.oAtCsslibPkgs || {};          // 组件@csslib配置的样式库【别名-包名】映射关系
        let oAtCsslibs = context.result.oAtCsslibs = context.result.oAtCsslibs || {};                   // 组件@csslib配置的样式库 (asname：lib)

        root.walk( 'Class', (node, object) => {

            // 查找@csslib属性节点，@csslib仅作用于当前所在标签
            let atcsslibNode;
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
                    throw new Err('unsupport expression on @csslib', { ...context.input, ...atcsslibNode.object.Value.pos });
                }

                // ---------------------------------
                // 解析@csslib
                let csslib = bus.at('解析csslib', atcsslibNode.object.value, context.input.file);
                if ( !csslib ) {
                    // 无效的@csslib格式
                    throw new Err('invalid @csslib value', { ...context.input, ...atcsslibNode.object.Value.pos });
                }

                // ---------------------------------
                // 保存@csslib位置以备用
                csslib.pos = { ...atcsslibNode.object.pos };

                // ---------------------------------
                // 检查别名冲突
                if ( oAtCsslibs[csslib.alias] ) {
                    // 不能和组件内的其他@csslib有别名冲突 （冲突将导致js代码中的样式库类名困惑，无法判断进行正确的哈希改名）
                    throw new Err('duplicate csslib name [*]', { ...context.input, ...csslib.pos });
                }
                if ( oCsslibs[csslib.alias] ) {
                    // 不能和组件[csslib]有别名冲突
                    throw new Err('duplicate csslib name [*]', { ...context.input, ...csslib.pos });
                }
                if ( oPrjCsslibs[csslib.alias] ) {
                    // 不能和项目[csslib]有别名冲突
                    throw new Err('duplicate csslib name [*]', { ...context.input, ...csslib.pos });
                }

                // ---------------------------------
                // 设定目标目录的绝对路径
                let dir;
                if ( csslib.pkg.startsWith('~') ) {
                    // 如果是目录，检查目录是否存在
                    let root = bus.at('文件所在项目根目录', context.input.file);
                    dir = csslib.pkg.replace(/\\/g, '/').replace(/^~\/*/, root + '/');
                    if ( !File.existsDir(dir) ) {
                        throw new Err('folder not found [' + dir + ']', { ...context.input, ...csslib.pos });
                    }
                }else{
                    // 自动安装
                    if ( !bus.at('自动安装', csslib.pkg) ) {
                        throw new Err('package install failed: ' + csslib.pkg, { ...context.input, ...csslib.pos });
                    }
                    
                    dir = getNodeModulePath(csslib.pkg);
                    if ( !dir ) {
                        // 要么安装失败，或又被删除，总之不应该找不到安装位置
                        throw new Err('package install path not found: ' + csslib.pkg, { ...context.input, ...csslib.pos });
                    }
                }
                csslib.dir = dir;                                                                       // 待导入的样式文件存放目录

                // ---------------------------------
                // 创建@csslib样式库
                let atcsslib = bus.at('样式库', csslib, context.input.file);
                if ( atcsslib.isEmpty ) {
                    throw new Err('css file not found', { file: context.input.file, text: context.input.text, start: csslib.pos.start, end: csslib.pos.end });
                }
                oAtCsslibs[csslib.alias] = atcsslib;                                                    // 存起来备查
                oAtCsslibPkgs[csslib.alias] = atcsslib.pkg;                                             // 保存样式库匿名关系，用于脚本类名转换
                atcsslib.isAtCsslib = true;
                atcsslib.attag = node.parent.object.standard ? node.parent.object.value : '';           // 保存当前标准标签名，便于@csslib查询样式库

                // ---------------------------------
                // 检查当前标签的样式类，并修改添加实际库名@后缀
                let oCsslibPC;
                for ( let i=0,ary,oCls,clsname,atname; oCls=object.classes[i++]; ) {
                    ary = oCls.Name.value.split('@');
                    clsname = '.' + ary[0];                                                             // 类名
                    atname = ary.length > 1 ? ary[1] : '';                                              // 库别名

                    if ( atname ) {
                        // 样式类有别名
                        if ( csslib.alias === atname ) {
                            // @csslib库匹配成功，但找不到样式类，报错
                            if ( !atcsslib.has(clsname) ) {
                                throw new Err(`class "${clsname}" not found in @csslib "${atname}"`, { ...context.input, start: oCls.Name.start, end: oCls.Name.end});
                            }
                        }else{
                            oCsslibPC = oCsslibs[atname] || oPrjCsslibs[atname];
                            if ( oCsslibPC  ) {
                                // [csslib]库匹配成功，但找不到样式类，报错
                                if ( !oCsslibPC.has(clsname) ) {
                                    throw new Err(`class "${clsname}" not found in [csslib] "${atname}"`, { ...context.input, start: oCls.Name.start, end: oCls.Name.end});
                                }
                            }else{
                                // 找不到指定别名的样式库，报错
                                throw new Err(`csslib not found "${atname}"`, { ...context.input, start: oCls.Name.start, end: oCls.Name.end});
                            }
                        }
                    }else{
                        // 样式类无别名
                        if ( csslib.alias === '*' && atcsslib.has(clsname) ) {
                            // 无名@csslib库匹配成功，且能找到样式类，起个别名添加
                            oCls.Name.value = ary[0] + '@' + Alias;                                     // 给@csslib无名样式库起一个哈希码别名
                            oAtCsslibs[Alias] = atcsslib;                                               // 自动配置一个同一别名的@csslib样式库
                            oAtCsslibPkgs[Alias] = atcsslib.pkg;                                        // 保存样式库匿名关系，用于脚本类名转换
                        }else{
                            oCsslibPC = oCsslibs['*'] || oPrjCsslibs['*'];
                            if ( oCsslibPC && oCsslibPC.has(clsname) ) {
                                oCls.Name.value = ary[0] + '@' + Alias;                                 // 给[csslib]无名样式库起一个哈希码别名
                                oCsslibs[Alias] = oCsslibPC;                                            // 自动配置一个同一别名的组件[csslib]样式库
                                oCsslibPkgs[Alias] = oCsslibPC.pkg;                                     // 保存样式库匿名关系，用于脚本类名转换
                            }
                        }
                    }

                }

                atcsslibNode.remove();                                                                  // @csslib的样式已生成，该节点删除

            }else{
                // ==============================================================================
                // 当前节点有class，但没有@csslib，做class的样式库别名检查 （理应分离检查，暂且先这样）
                // ==============================================================================

                // ---------------------------------
                // 检查当前标签的样式类，并修改添加实际库名@后缀
                let oCsslibPC;
                for ( let i=0,ary,oCls,clsname,atname; oCls=object.classes[i++]; ) {
                    ary = oCls.Name.value.split('@');
                    clsname = '.' + ary[0];                                                             // 类名
                    atname = ary.length > 1 ? ary[1] : '';                                              // 库别名

                    if ( atname ) {
                        // 样式类有别名
                        oCsslibPC = oCsslibs[atname] || oPrjCsslibs[atname];
                        if ( oCsslibPC  ) {
                            // [csslib]库匹配成功，但找不到样式类，报错
                            if ( !oCsslibPC.has(clsname) ) {
                                throw new Err(`class "${clsname}" not found in [csslib] "${atname}"`, {file:context.input.file, text:context.input.text, start: oCls.Name.start, end: oCls.Name.end});
                            }
                        }else{
                            // 找不到指定别名的样式库，报错
                            throw new Err(`csslib not found "${atname}"`, {file:context.input.file, text:context.input.text, start: oCls.Name.start, end: oCls.Name.end});
                        }
                    }else{
                        // 样式类无别名
                        oCsslibPC = oCsslibs['*'] || oPrjCsslibs['*'];
                        if ( oCsslibPC && oCsslibPC.has(clsname) ) {
                            oCls.Name.value = ary[0] + '@' + Alias;                                     // 给[csslib]无名样式库起一个哈希码别名
                            oCsslibs[Alias] = oCsslibPC;                                                // 自动配置一个同一别名的组件[csslib]样式库
                            oCsslibPkgs[Alias] = oCsslibPC.pkg;                                         // 保存样式库匿名关系，用于脚本类名转换
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

