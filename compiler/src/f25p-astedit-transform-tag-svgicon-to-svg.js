const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const resolvepkg = require('resolve-pkg');

bus.on('编译插件', function(){
    
    // 内置标签<svgicon>转换处理
    // 解析替换为<svg>标签
    return postobject.plugin(/**/__filename/**/, function(root, context){
        
        root.walk( 'Tag', (node, object) => {
            if ( !/^svgicon$/i.test(object.value) ) return;

            // 查找Attributes
            let attrsNode;
            if ( node.nodes ) {
                for ( let i=0,nd; nd=node.nodes[i++]; ) {
                    if ( nd.type === 'Attributes' ) {
                        attrsNode = nd;
                        break;
                    }
                }
            }

            let nodeName, nodeType, iconName, iconType, oAttrs = {};
            attrsNode && attrsNode.nodes.forEach(nd => {
                let name = nd.object.name;
                if ( /^type$/i.test(name) ) {
                    // type属性是svgicon专用属性，用于指定使用图标展示方式
                    iconType = (nd.object.value+'').trim();                                                     // 属性节点type
                    nodeType = nd;
                }else if ( /^name$/i.test(name) ) {
                    // name属性是svgicon专用属性，用于指定图标名
                    nodeName = nd;
                    iconName = nd.object.value.trim();                                                          // 属性节点name
                }else{
                    // 其他属性全部作为svg标签用属性看待，效果上等同内联svg标签中直接写属性，但viewBox属性除外，viewBox不支持修改以免影响svg大小
                    !/^viewBox$/i.test(name) && (oAttrs[nd.object.name] = nd.object);
                }
            });

            !iconType && (iconType = 'svg');                                                                    // 缺省为 svg，直接显示svg
            if ( !nodeName ) {
                throw new Err('missing name attribute on tag svgicon', { ...context.input, ...object.pos });    // 不能没有name属性
            }

            let errInfoName = { ...context.input, ...nodeName.object.Value.pos };
            if ( !iconName ) {
                throw new Err('invalid value of name attribute', errInfoName);                                  // 不能没有name属性值
            }

            // svg(内联svg)/inline-symbol(内联symbol定义)/link-symbol(外部symbol定义)
            if ( /^svg$/i.test(iconType) ) {
                // -------------------------------
                // svg(内联svg)
                // 【特点】可灵活引用svg图标
                // -------------------------------
                if ( bus.at('是否表达式', iconName) ) {
                    throw new Err('unsupport expression when type is "svg"', errInfoName);                      // inline模式时name属性不支持表达式
                }
                
                iconName = iconName.replace(/\\/g, '/');
                !/\.svg$/i.test(iconName) && (iconName += '.svg');                                              // 后缀可以省略，如果没写则补足

                let svgfile, ary = iconName.split(':');
                if ( ary.length > 2 ) {
                    throw new Err('invalid format of name attribute, etc. pkg:svgfilter', errInfoName);         // 格式有误，多个冒号
                }else if ( ary.length > 1 ) {
                    svgfile = findSvgByPkgFilter(ary, iconName, errInfoName, context.input.file);               // 从npm包中查找
                }else{
                    svgfile = findSvgInProjectAndBuildinPkg(iconName, errInfoName, context.input.file);         // 从工程内和内置包中查找

                    if ( !svgfile.startsWith(resolvepkg('@rpose/buildin')) ) {
                        let refsvgicons = context.result.refsvgicons = context.result.refsvgicons || [];        // 项目中的svg文件可能修改，保存依赖关系以便修改时重新编译
                        !refsvgicons.includes(svgfile) && refsvgicons.push(svgfile);                            // 当前组件依赖此svg文件，用于文件监视模式，svg改动时重新编译
                    }
                }

                let allrefsvgicons = context.result.allrefsvgicons = context.result.allrefsvgicons || [];       // 硬编码用到的全部图标文件
                !allrefsvgicons.includes(svgfile) && allrefsvgicons.push(svgfile);

                let nodeSvgTag;
                try{
                    nodeSvgTag = bus.at('SVG图标文件解析', svgfile, oAttrs, object.pos);
                }catch(e){
                    throw new Err( e.message, e, { ...context.input, ...nodeName.object.pos });
                }
               
                // 替换为内联svg标签节点
                nodeSvgTag && node.replaceWith(nodeSvgTag);

            }else if ( /^inline-symbol$/i.test(iconType) ) {
                // -------------------------------
                // inline-symbol(内联symbol定义)
                // 【特点】以页面为单位，按需内联引用
                // -------------------------------
                if ( bus.at('是否表达式', iconName) ) {
                    throw new Err('unsupport expression when type is "inline-symbol"', errInfoName);            // inline-symbol模式时name属性不支持表达式
                }
                
                iconName = iconName.replace(/\\/g, '/');
                !/\.svg$/i.test(iconName) && (iconName += '.svg');                                              // 后缀可以省略，如果没写则补足

                let svgfile, ary = iconName.split(':');
                if ( ary.length > 2 ) {
                    throw new Err('invalid format of name attribute, etc. pkg:svgfilter', errInfoName);         // 格式有误，多个冒号
                }else if ( ary.length > 1 ) {
                    svgfile = findSvgByPkgFilter(ary, iconName, errInfoName, context.input.file);               // 从npm包中查找
                }else{
                    svgfile = findSvgInProjectAndBuildinPkg(iconName, errInfoName, context.input.file);         // 从工程内和内置包中查找

                    if ( !svgfile.startsWith(resolvepkg('@rpose/buildin')) ) {
                        let refsvgicons = context.result.refsvgicons = context.result.refsvgicons || [];        // 项目中的svg文件可能修改，保存依赖关系以便修改时重新编译
                        !refsvgicons.includes(svgfile) && refsvgicons.push(svgfile);                            // 当前组件依赖此svg文件，用于文件监视模式，svg改动时重新编译
                    }
                }

                let allrefsvgicons = context.result.allrefsvgicons = context.result.allrefsvgicons || [];       // 硬编码用到的全部图标文件
                !allrefsvgicons.includes(svgfile) && allrefsvgicons.push(svgfile);

                let inlinesymbols = context.result.inlinesymbols = context.result.inlinesymbols || [];          // symbol内联关联的svg文件
                !inlinesymbols.includes(svgfile) && inlinesymbols.push(svgfile);

                let id = hash(File.read(svgfile));                                                              // 珍惜id资源，用文件内容哈希作为id以避免冲突 （不支持表达式，编译决定，基本没影响）
                let props = {};
                for ( let k in oAttrs ) {
                    props[k] = oAttrs[k].value;
                }
                let strSvgUse = bus.at('生成内部引用SVG-USE', id, props);                                        // 生成标签字符串，类似 <svg ...><use ...></use></svg>
                let nodeSvgUse = bus.at('解析生成AST节点', strSvgUse);                                           // 转成AST节点
                node.replaceWith(nodeSvgUse);

            }else if ( /^link-symbol$/i.test(iconType) ) {
                // -------------------------------
                // link-symbol(外部symbol定义)
                // 【特点】工程单位范围内可动态生成
                // -------------------------------
                let props = {};
                for ( let k in oAttrs ) {
                    props[k] = oAttrs[k].value;
                }

                context.result.hasRefSvgSymbol = true;                                                              // 有无外部symbol定义的标记

                // 如果是硬编码，把找到的文件存起来，以支持添加工程外图标
                if ( !bus.at('是否表达式', iconName) ) {
                    iconName = iconName.replace(/\\/g, '/');
                    !/\.svg$/i.test(iconName) && (iconName += '.svg');                                              // 后缀可以省略，如果没写则补足

                    let svgfile, ary = iconName.split(':');
                    if ( ary.length > 2 ) {
                        throw new Err('invalid format of name attribute, etc. pkg:svgfilter', errInfoName);         // 格式有误，多个冒号
                    }else if ( ary.length > 1 ) {
                        svgfile = findSvgByPkgFilter(ary, iconName, errInfoName, context.input.file);               // 从npm包中查找
                    }else{
                        svgfile = findSvgInProjectAndBuildinPkg(iconName, errInfoName, context.input.file);         // 从工程内和内置包中查找

                        if ( !svgfile.startsWith(resolvepkg('@rpose/buildin')) ) {
                            let refsvgicons = context.result.refsvgicons = context.result.refsvgicons || [];        // 项目中的svg文件可能修改，保存依赖关系以便修改时重新编译
                            !refsvgicons.includes(svgfile) && refsvgicons.push(svgfile);                            // 当前组件依赖此svg文件，用于文件监视模式，svg改动时重新编译
                        }
                    }

                    let allrefsvgicons = context.result.allrefsvgicons = context.result.allrefsvgicons || [];       // 硬编码用到的全部图标文件
                    !allrefsvgicons.includes(svgfile) && allrefsvgicons.push(svgfile);

                    let strSvgUse = bus.at('生成外部引用SVG-USE', svgfile, props);                                   // 生成标签字符串，类似 <svg ...><use ...></use></svg>
                    let nodeSvgUse = bus.at('解析生成AST节点', strSvgUse);                                           // 转成AST节点
                    node.replaceWith(nodeSvgUse);

                }else{
                    let strSvgUse = bus.at('生成外部引用SVG-USE', iconName, props);                                  // 生成标签字符串，类似 <svg ...><use ...></use></svg>
                    let nodeSvgUse = bus.at('解析生成AST节点', strSvgUse);                                           // 转成AST节点
                    node.replaceWith(nodeSvgUse);
                }

            }else{
                // 错误类型，提示修改
                throw new Err(`support type (${iconType}), etc. svg | inline-symbol | link-symbol`, { ...context.input, ...nodeType.object.Value.pos });
            }

        });

    });

}());

// 在npm包中查找
function findSvgByPkgFilter(ary, nameProp, errInfo, fromFile){

    // 简单排除window环境下书写绝对路径的情况
    if ( File.existsFile(nameProp) ) {
        throw new Err('unsupport absolute file path', errInfo);                                             // 不支持使用绝对路径，避免换机器环境引起混乱
    }

    // 指定NPM包中文件的形式，npm包视为稳定，支持使用通配符提高灵活性
    let pkg = ary[0].trim();
    let filter = ary[1].trim();
    if ( !pkg ) {
        throw new Err('missing npm package name, etc. pkg:svgfilter', errInfo);                             // 输入有误，漏包名
    }
    if ( !filter ) {
        throw new Err('missing svf file filter, etc. pkg:svgfilter', errInfo);                              // 输入有误，漏文件名
    }

    if ( !bus.at('自动安装', pkg) ) {
        throw new Err('npm package install failed: ' + pkg, errInfo);                                       // 指定包安装失败
    }

    // 检查缓存
    let env = bus.at('编译环境');
    let oCache = bus.at('缓存');
    let cacheKey = JSON.stringify(['按包名：过滤器查找SVG图标文件', File.path(fromFile), pkg, filter]);
    if ( !env.nocache ) {
        let cacheValue = oCache.get(cacheKey);
        if ( cacheValue ) return cacheValue;
    }

    let oPkg = bus.at('模块组件信息', pkg);
    let files = File.files(oPkg.path, filter);
    if ( !files.length ) {
        // 默认找不到时，添加任意目录条件再找一遍，如果能找到唯一一个也算成功
        let filter2 = ("**/" + filter).replace(/\/\//g, '/');
        files = File.files(oPkg.path, filter2);
        if ( files.length != 1 ) {
            // 找不到唯一一个，则按没找到处理
            throw new Err('svf file not found in package: ' + pkg, errInfo);                                // npm包安装目录内找不到指定的图标文件
        }
    }

    if ( files.length > 1 ) {
        // 找到多个时，按错误处理
        throw new Err('multi svf file found in package: ' + pkg + '\n' + files.join('\n'), errInfo);        // npm包安装目录内找到多个图标文件 （通配符匹配到多个导致，应修改）
    }

    return oCache.set(cacheKey, files[0]);                                                                  // 正常找到唯一的一个文件
}

// 在工程内和内置包中查找
function findSvgInProjectAndBuildinPkg(filter, errInfo, fromFile){

    // --------------------------------------------
    // 优先按源文件相对目录，直接拼接路径查找文件
    let oPjtContext = bus.at("项目配置处理", fromFile);
    let svgfile = File.resolve(fromFile, filter);                                                           // 相对于源文件所在目录，按相对路径查找svg文件
    if ( File.existsFile(svgfile) ) {
        if ( !svgfile.startsWith(oPjtContext.path.root + '/') ) {
            throw new Err('file should not out of project\nsrc: ' + fromFile
                + '\nsvg: ' + svgfile, errInfo);                                                            // 不支持引用项目外文件，避免版本混乱
        }
        return svgfile;                                                                                     // 按源文件相对目录找到
    }

    // --------------------------------------------
    // 其次以文件所在的项目配置指定目录，按过滤条件查找
    let dir = oPjtContext.path.svgicons;
    let files = File.files(dir, filter);
    if ( files.length == 1 ) {
        if ( files[0] === filter ) {
            throw new Err('unsupport absolute file path', errInfo);                                         // 不支持使用绝对路径，避免换机器环境引起混乱
        }
        return files[0];                                                                                    // 项目配置指定目录中找到
    }

    // 默认找不到时，添加任意目录条件再找一遍，如果能找到唯一一个也算成功
    let filter2, files2;
    if ( files.length < 1 ) {
        filter2 = ("**/" + filter).replace(/\/\//g, '/');
        files2 = File.files(dir, filter2);
        if ( files2.length == 1 ) {
            if ( files2[0] === filter ) {
                throw new Err('unsupport absolute file path', errInfo);                                     // 不支持使用绝对路径，避免换机器环境引起混乱
            }
            return files2[0];                                                                               // 项目配置指定目录中二次找到
        }
    }

    // --------------------------------------------
    // 在内置npm包中查找
    let buildindir = resolvepkg('@rpose/buildin') + '/svgicons';
    let buildinfiles = File.files(buildindir, filter);
    if ( buildinfiles.length == 1 ) {
        return buildinfiles[0];                                                                             // 内置npm包中找到
    }

    // 默认找不到时，添加任意目录条件再找一遍，如果能找到唯一一个也算成功
    let buildinfilter2, buildinfiles2;
    if ( buildinfiles.length < 1 ) {
        buildinfilter2 = ("**/" + filter).replace(/\/\//g, '/');
        buildinfiles2 = File.files(buildindir, buildinfilter2);
        if ( buildinfiles2.length == 1 ) {
            if ( buildinfiles2[0] === filter ) {
                throw new Err('unsupport absolute file path', errInfo);                                     // 不支持使用绝对路径，避免换机器环境引起混乱
            }
            return buildinfiles2[0];                                                                        // 内置npm包中二次找到
        }
    }


    // 报错
    if ( files.length > 1 || files2.length > 1 ) {
        throw new Err('multi svf file found in folder: ' + dir + '\n'
            + [...files, ...files2].join('\n'), errInfo);                                                   // 报错，项目配置指定目录中找到多个
    }
    if ( buildinfiles.length > 1 || buildinfiles2.length > 1 ) {
        throw new Err('multi svf file found in package [@rpose/buildin]\n'
            + [...buildinfiles, ...buildinfiles2].join('\n'), errInfo);                                     // 报错，内置npm包中找到多个
    }
    throw new Err('svf file not found', errInfo);                                                           // 找不到
}
