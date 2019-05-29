const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 内置标签<svgicon>转换处理
    // 解析替换为<svg>标签
    return postobject.plugin(/**/__filename/**/, function(root, context){

        context.result.hasSvgInlineSymbol = false;                                                              // 有无内联Symbol
        context.result.hasSvgLinkSymbol = false;                                                                // 有无外部Symbol
        context.result.hasDinamicSvg = false;                                                                   // 有无动态svg影响（svg表达式、内联Symbol、外联Symbol）
        context.result.hasSvgIcon = false;                                                                      // 有无使用图标

        root.walk( 'Tag', (node, object) => {
            if ( !/^svgicon$/i.test(object.value) ) return;

            context.result.hasSvgIcon = true;                                                                   // 有无使用图标

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
                // 【特点】可灵活控制svg图标
                // -------------------------------
                if ( bus.at('是否表达式', iconName) ) {
                    // 使用表达式时，运行期判断显示相应图标，默认范围限于工程图标目录
                    let nodeSvgTags;
                    try{
                        let text = bus.at('动态判断显示SVG标签', iconName, context.input.file);
                        nodeSvgTags = bus.at('SVG图标内容解析为AST节点数组', null, text, oAttrs, object.pos);
                    }catch(e){
                        throw new Err( e.message, e, { ...context.input, ...nodeName.object.pos });
                    }
                   
                    // 替换为内联svg标签节点
                    nodeSvgTags && node.replaceWith(...nodeSvgTags);
                    context.result.hasDinamicSvg = true;

                }else{
                    // 硬编码时，直接显示相应图标
                    let oFile = findSvgFileInProject(iconName, errInfoName, context.input.file);                    // 从工程中查找唯一的图标文件，找不到则报错

                    let nodeSvgTags = bus.at('SVG图标内容解析为AST节点数组', oFile.file, null, oAttrs, object.pos);
                    nodeSvgTags && node.replaceWith(...nodeSvgTags);                                                // 替换为内联svg标签节点
                }
                

            }else if ( /^inline-symbol$/i.test(iconType) ) {
                // -------------------------------
                // inline-symbol(内联symbol定义)
                // 【特点】减少重复
                // -------------------------------
                let props = {};
                for ( let k in oAttrs ) {
                    props[k] = oAttrs[k].value;
                }

                context.result.hasSvgInlineSymbol = true;
                context.result.hasDinamicSvg = true;

                let symbolId;
                if ( bus.at('是否表达式', iconName) ) {
                    // 使用表达式，在运行期确定symbolId相应的图标
                    symbolId = iconName;
                }else{
                    // 硬编码时，检查文件是否存在
                    let oFile = findSvgFileInProject(iconName, errInfoName, context.input.file);                    // 从工程中查找唯一的图标文件，找不到则报错
                    symbolId = oFile.file;
                }

                let strSvgUse = bus.at('生成SVG引用内联SYMBOL', symbolId, context.input.file, props);                // 生成标签字符串，类似 <svg ...><use ...></use></svg>
                let nodeSvgUse = bus.at('SVG图标引用解析为AST节点', strSvgUse);                                      // 转成AST节点
                node.replaceWith(nodeSvgUse);

            }else if ( /^link-symbol$/i.test(iconType) ) {
                // -------------------------------
                // link-symbol(外部symbol定义)
                // 【特点】能缓存
                // -------------------------------
                let props = {};
                for ( let k in oAttrs ) {
                    props[k] = oAttrs[k].value;
                }

                context.result.hasSvgLinkSymbol = true;
                context.result.hasDinamicSvg = true;

                let symbolId;
                if ( bus.at('是否表达式', iconName) ) {
                    // 使用表达式，在运行期确定symbolId相应的图标
                    symbolId = iconName;
                }else{
                    // 硬编码时，检查文件是否存在
                    let oFile = findSvgFileInProject(iconName, errInfoName, context.input.file);                    // 从工程中查找唯一的图标文件，找不到则报错
                    symbolId = oFile.file;
                }

                let strSvgUse = bus.at('生成SVG引用外部SYMBOL', symbolId, context.input.file, props);                // 生成标签字符串，类似 <svg ...><use ...></use></svg>
                let nodeSvgUse = bus.at('SVG图标引用解析为AST节点', strSvgUse);                                      // 转成AST节点
                node.replaceWith(nodeSvgUse);

            }else{
                // 错误类型，提示修改
                throw new Err(`support type (${iconType}), etc. svg | inline-symbol | link-symbol`, { ...context.input, ...nodeType.object.Value.pos });
            }

        });

    });

    // 从工程中查找图标文件（直接内联svg时，检查重名，其他情况在页面生成时统一检查）
    function findSvgFileInProject(filename, errInfo, fromFile){

        let oSvg = bus.at('项目SVG图标文件列表', fromFile); // 已含重名检查

        // 按文件名匹配，忽略大小写
        for ( let i=0,oFile; oFile=oSvg.files[i++]; ) {
            if ( oFile.name === filename.toLowerCase() ) {
                return oFile;
            }
        }

        throw new Err(`svg icon file not found (${filename})`, errInfo); // 图标文件找不到
    }

}());

