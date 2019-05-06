const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');
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

            let nodeSrc, nodeType, iconName, iconType = 'inline', oAttrs = {};
            attrsNode && attrsNode.nodes.forEach(nd => {
                let name = nd.object.name;
                if ( /^src$/i.test(name) ) {
                    // src属性是svgicon专用属性，用于指定svg文件
                    nodeSrc = nd;                                                   // 属性节点src
                }else if ( /^type$/i.test(name) ) {
                    // type属性是svgicon专用属性，用于指定使用图标展示方式
                    iconType = nd.object.value.trim();                              // 属性节点type
                    nodeType = nd;
                }else if ( /^name$/i.test(name) ) {
                    // name属性是svgicon专用属性，用于symbol(外部引用svg symbol)方式时指定图标名
                    iconName = nd.object.value.trim();                              // 属性节点name
                }else{
                    // 其他属性全部作为svg标签用属性看待，效果上等同内联svg标签中直接写属性，但viewBox属性除外，viewBox不支持修改以免影响svg大小
                    !/^viewBox$/i.test(name) && (oAttrs[nd.object.name] = nd.object);
                }
            });
            

            // inline(内联svg)/inline-symbol(内联svg symbol)/symbol(外部引用svg symbol)/web-font(引用字体)
            if ( /^inline-symbol$/i.test(iconType) ) {
                // -------------------------------
                // inline-symbol(内联svg symbol)
                // 【特点】以页面为单位，按需内联引用
                // -------------------------------
                if ( !nodeSrc ) {
                    throw new Err('missing src attribute of svgicon(type="inline-symbol")',
                        {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                }

                // 文件检查
                let errLocInfo = {file: context.input.file, text: context.input.text, start: nodeSrc.object.loc.start.pos, end: nodeSrc.object.loc.end.pos};    // 定位src处
                let propSrc = nodeSrc.object.value.trim();
                if ( !propSrc ) {
                    throw new Err('invalid value of attribute src', errLocInfo);                                // 必须指定图标
                }
                
                propSrc = propSrc.replace(/\\/g, '/');
                !/\.svg$/i.test(propSrc) && (propSrc += '.svg');                                                // 后缀可以省略，如果没写则补足

                let svgfile, ary = propSrc.split(':');
                if ( ary.length > 2 ) {
                    throw new Err('invalid format of src attribute, etc. name:filefilter', errLocInfo);         // 格式有误，多个冒号
                }else if ( ary.length > 1 ) {
                    svgfile = findSvgByPkgFilter(ary, propSrc, errLocInfo);                                     // 从npm包中查找
                }else{
                    svgfile = findSvgInProject(propSrc, errLocInfo, context);                                   // 从项目中查找

                    let refsvgicons = context.result.refsvgicons = context.result.refsvgicons || [];            // 项目中的svg文件可能修改，保存依赖关系编译修改时重新编译
                    !refsvgicons.includes(svgfile) && refsvgicons.push(svgfile);                                // 当前组件依赖此svg文件，用于文件监视模式，svg改动时重新编译
                }

                let inlinesymbols = context.result.inlinesymbols = context.result.inlinesymbols || [];          // symbol内联关联的svg文件
                !inlinesymbols.includes(svgfile) && inlinesymbols.push(svgfile);

                let id = File.name(svgfile);
                let props = {};
                for ( let k in oAttrs ) {
                    props[k] = oAttrs[k].value;
                }
                let strSvgUse = bus.at('生成内部引用SVG-USE', id, props);
                let nodeSvgUse = bus.at('解析生成AST节点', strSvgUse);
                node.replaceWith(nodeSvgUse);

            }else if ( /^symbol$/i.test(iconType) ) {
                // -------------------------------
                // symbol(外部引用svg symbol)
                // 【特点】工程单位范围内可动态生成
                // -------------------------------
                if ( !iconName ) {
                    throw new Err('missing name attribute of svgicon(type="symbol")',
                        {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                }

                let props = {};
                for ( let k in oAttrs ) {
                    props[k] = oAttrs[k].value;
                }
                let strSvgUse = bus.at('生成外部引用SVG-USE', iconName, props);
                let nodeSvgUse = bus.at('解析生成AST节点', strSvgUse);
                node.replaceWith(nodeSvgUse);

                context.result.hasRefSvgSymbol = true;
                bus.at('生成项目SVG-SYMBOL文件');

            }else if ( /^web[-]?font[s]?$/i.test(iconType) ) {
                // -------------------------------
                // web-font(引用字体)
                // 【特点】兼容低版本浏览器
                // -------------------------------
                throw new Err('unsupport icon type: ' + iconType);   // 尚未对应

            }else if ( /^inline$/i.test(iconType) ) {
                // -------------------------------
                // inline-svg(内联svg)
                // 【特点】可灵活引用svg图标
                // -------------------------------
                if ( !nodeSrc ) {
                    throw new Err('missing src attribute of svgicon(type="inline-symbol")',
                        {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
                }

                // 文件检查
                let errLocInfo = {file: context.input.file, text: context.input.text, start: nodeSrc.object.loc.start.pos, end: nodeSrc.object.loc.end.pos};    // 定位src处
                let propSrc = nodeSrc.object.value.trim();
                if ( !propSrc ) {
                    throw new Err('invalid value of attribute src', errLocInfo);                                // 必须指定图标
                }
                
                propSrc = propSrc.replace(/\\/g, '/');
                !/\.svg$/i.test(propSrc) && (propSrc += '.svg');                                                // 后缀可以省略，如果没写则补足

                let svgfile, ary = propSrc.split(':');
                if ( ary.length > 2 ) {
                    throw new Err('invalid format of src attribute, etc. name:filefilter', errLocInfo);         // 格式有误，多个冒号
                }else if ( ary.length > 1 ) {
                    svgfile = findSvgByPkgFilter(ary, propSrc, errLocInfo);                                     // 从npm包中查找
                }else{
                    svgfile = findSvgInProject(propSrc, errLocInfo, context);                                   // 从项目中查找

                    if ( !svgfile ) {
                        svgfile = findSvgInBuildInPackage(propSrc, errLocInfo, context);                        // 从内置npm包中查找
                    }

                    let refsvgicons = context.result.refsvgicons = context.result.refsvgicons || [];            // 项目中的svg文件可能修改，保存依赖关系编译修改时重新编译
                    !refsvgicons.includes(svgfile) && refsvgicons.push(svgfile);                                // 当前组件依赖此svg文件，用于文件监视模式，svg改动时重新编译
                }

                let nodeSvgTag;
                try{
                    nodeSvgTag = bus.at('SVG图标文件解析', svgfile, oAttrs, object.loc);
                }catch(e){
                    throw new Err( e.message, e, {file: context.input.file, text: context.input.text, start: nodeSrc.object.loc.start.pos, end: nodeSrc.object.loc.end.pos});
                }
               
                // 替换为内联svg标签节点
                nodeSvgTag && node.replaceWith(nodeSvgTag);

            }else{
                // -------------------------------
                // 错误的type
                // -------------------------------
                throw new Err('invalid type of svgicon (etc. inline/inline-symbol/symbol)',
                    {file: context.input.file, text: context.input.text, start: nodeType.object.loc.start.pos, end: nodeType.object.loc.end.pos});
            }

        });

    });

}());

function findSvgByPkgFilter(ary, propSrc, errLocInfo){

    // 简单排除window环境下书写绝对路径的情况
    if ( File.existsFile(propSrc) ) {
        throw new Err('unsupport absolute file path', errLocInfo);                              // 不支持使用绝对路径，避免换机器环境引起混乱
    }

    // 指定NPM包中文件的形式，npm包视为稳定，支持使用通配符提高灵活性
    let pkg = ary[0].trim();
    let filter = ary[1].trim();
    if ( !pkg ) {
        throw new Err('missing npm package name, etc. name:svgfilefilter', errLocInfo);         // 输入有误，漏包名
    }
    if ( !filter ) {
        throw new Err('missing svf icon file filter, etc. name:svgfilefilter', errLocInfo);     // 输入有误，漏文件名
    }

    let ok = bus.at('自动安装', pkg);
    if ( !ok ) {
        throw new Err('npm package install failed: ' + pkg, errLocInfo);                        // 指定包安装失败
    }


    // 检查缓存
    let env = bus.at('编译环境');
    let oCache = bus.at('缓存');
    let cacheKey = JSON.stringify(['search-svgicon-by-pkg-filter', env.path.root, pkg, filter]);
    if ( !env.nocache ) {
        let cacheValue = oCache.get(cacheKey);
        if ( cacheValue ) return cacheValue;
    }

    let oPkg = bus.at('模块组件信息', pkg);
    let files = File.files(oPkg.path, filter);
    if ( !files.length && !filter.startsWith("**/") ) {
        // 默认找不到时，任意上级目录下下再找一遍
        filter = ("**/" + filter).replace(/\/\//g, '/');
        files = File.files(oPkg.path, filter);

        // 找到唯一一个就算对，否则按没找到处理
        if ( files.length != 1 ) {
            throw new Err('svf icon file not found in package: ' + pkg, errLocInfo);            // npm包安装目录内找不到指定的图标文件
        }
    }

    if ( !files.length ) {
        throw new Err('svf icon file not found in package: ' + pkg, errLocInfo);                // npm包安装目录内找不到指定的图标文件
    }
    if ( files.length > 1 ) {
        throw new Err('multi svf icon file found in package: ' + pkg + '\n' + files.join('\n'), errLocInfo);       // npm包安装目录内找到多个图标文件 （通配符匹配到多个导致，应修改）
    }

    return oCache.set(cacheKey, files[0]);                                                      // 正常找到唯一的一个文件
}

function findSvgInProject(propSrc, errLocInfo, context){

    // 项目目录范围内指定文件的形式，优先按源文件相对目录查找，其次在项目配置指定目录中查找
    let filter = propSrc.trim();

    let oPjt = bus.at('项目配置处理', context.input.file);
    let svgfile = File.resolve(context.input.file, filter);                                     // 相对于源文件所在目录，按相对路径查找svg文件
    if ( File.existsFile(svgfile) ) {
        // 优先按源文件相对目录查找，如果找到的svg不在该文件所在项目范围，报错
        if ( !svgfile.startsWith(oPjt.path.root + '/') ) {
            throw new Err('file should not out of project\nsrc: ' + context.input.file + '\nsvg: ' + svgfile, errLocInfo);      // 不支持引用项目外文件，避免版本混乱
        }
    }else {
        // 其次在文件所在的项目配置指定目录中查找
        if ( !/^[./\\]+/.test(filter) ) {
            svgfile = oPjt.path.svgicons + '/' + filter.replace(/\\/g, '/');
            if ( !File.existsFile(svgfile) ) {
                return false;
            }
        }else{
            return false;
        }
    }

    if ( svgfile === filter ) {
        throw new Err('unsupport absolute file path', errLocInfo);                              // 不支持使用绝对路径，避免换机器环境引起混乱
    }

    return svgfile;
}

function findSvgInBuildInPackage(propSrc, errLocInfo){
    let dir = resolvepkg('@rpose/buildin') + '/svgicons';
    let files = File.files(dir, propSrc.trim());
    if ( !files.length ) {
        throw new Err('svf icon file not found', errLocInfo);                                   // 内置包中找不到指定的图标文件
    }
    if ( files.length > 1 ) {
        throw new Err('multi svf icon file found in package [@rpose/buildin]\n' + files.join('\n'), errLocInfo);     // 内置包中找到多个图标文件
    }

    return files[0];
}
