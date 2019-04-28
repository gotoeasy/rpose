const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const File = require('@gotoeasy/file');

bus.on('编译插件', function(){
    
    // 内置标签<svgicon>转换处理
    // 解析替换为<svg>标签
    return postobject.plugin(/**/__filename/**/, function(root, context){
        
        root.walk( 'Tag', (node, object) => {
            if ( !/^svgicon$/i.test(object.value) ) return;

            // 查找Attributes
            let attrsNode;
            for ( let i=0,nd; nd=node.nodes[i++]; ) {
                if ( nd.type === 'Attributes' ) {
                    attrsNode = nd;
                    break;
                }
            }

            let nodeSrc, oAttrs = {};
            attrsNode && attrsNode.nodes.forEach(nd => {
                let name = nd.object.name;
                if ( /^src$/i.test(name) ) {
                    // src属性是svgicon专用属性，用于指定svg文件
                    nodeSrc = nd;                                   // 属性节点src
                }else{
                    // 其他属性全部作为svg标签用属性看待，效果上等同内联svg标签中直接写属性，但viewBox属性除外，viewBox不支持修改以免影响svg大小
                    !/^viewBox$/i.test(name) && (oAttrs[nd.object.name] = nd.object);
                }
            });
            

            if ( !nodeSrc ) {
                throw new Err('missing src attribute of svgicon', {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});   // 必须指定图标
            }

            let errLocInfo = {file: context.input.file, text: context.input.text, start: nodeSrc.object.loc.start.pos, end: nodeSrc.object.loc.end.pos};    // 定位src处
            let propSrc = nodeSrc.object.value.trim();
            if ( !propSrc ) {
                throw new Err('invalid value of attribute src', errLocInfo);   // 必须指定图标
            }
            
            // 后缀可以省略，如果没写则补足
            propSrc = propSrc.replace(/\\/g, '/');
            !/\.svg$/i.test(propSrc) && (propSrc += '.svg');

            let svgfile, pkg, filter, ary = propSrc.split(':');
            if ( ary.length > 2 ) {
                throw new Err('invalid format of src attribute, etc. name:svgfilefilter', errLocInfo);      // 格式有误，多个冒号
            }else if ( ary.length > 1 ) {
                // 简单排除window环境下书写绝对路径的情况
                if ( File.existsFile(propSrc) ) {
                    throw new Err('unsupport absolute file path', errLocInfo);                              // 不支持使用绝对路径，避免换机器环境引起混乱
                }

                // 指定NPM包中文件的形式，npm包视为稳定，支持使用通配符提高灵活性
                pkg = ary[0].trim();
                filter = ary[1].trim();
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

                let oPkg = bus.at('模块组件信息', pkg);
                if ( filter.indexOf("*") < 0 ) {
                    filter.startsWith("/") ? (filter = "**" + filter) : (filter = "**/" + filter);          // 没有通配符时默认添加任意目录的通配符
                }
                let files = File.files(oPkg.path, filter);

                if ( !files.length ) {
                    throw new Err('svf icon file not found in package: ' + pkg, errLocInfo);                // npm包安装目录内找不到指定的图标文件
                }
                if ( files.length > 1 ) {
                    throw new Err('multi svf icon file found in package: ' + pkg + '\n' + files.join('\n'), errLocInfo);       // npm包安装目录内找到多个图标文件 （通配符匹配到多个导致，应修改）
                }
                svgfile = files[0];                                                                         // 正常找到唯一的一个文件

            }else{
                // 项目目录范围内指定文件的形式，优先按源文件相对目录查找，其次在项目配置指定目录中查找
                filter = propSrc.trim();

                let env = bus.at('编译环境');
                let hasFile;
                svgfile = File.resolve(context.input.file, filter);                                         // 相对于源文件所在目录，按相对路径查找svg文件
                if ( File.existsFile(svgfile) ) {
                    // 优先按源文件相对目录查找
                    if ( !svgfile.startsWith(env.path.root + '/') ) {
                        throw new Err('file should not out of project (' + svgfile + ')', errLocInfo);             // 不支持引用项目外文件，避免版本混乱
                    }
                    hasFile = true;
                }else {
                    // 其次在项目配置指定目录中查找
                    if ( !/^[\.\/\\]+/.test(filter) ) {
                        svgfile = env.path.svgicons + '/' + filter.replace(/\\/g, '/');
                        if ( File.existsFile(svgfile) ) {
                            hasFile = true;
                        }
                    }
                }

                if ( !hasFile ) throw new Err('svf icon file not found', errLocInfo);                       // 项目范围内找不到指定的图标文件

                if ( svgfile === filter ) throw new Err('unsupport absolute file path', errLocInfo);        // 不支持使用绝对路径，避免换机器环境引起混乱

                let refsvgicons = context.result.refsvgicons = context.result.refsvgicons || [];
                !refsvgicons.includes(svgfile) && refsvgicons.push(svgfile);                                // 当前组件依赖此svg文件，用于文件监视模式，svg改动时重新编译
            }


            // 解析
            let nodeSvgTag;
            try{
                nodeSvgTag = bus.at('SVG图标文件解析', svgfile, oAttrs, object.loc);
            }catch(e){
                throw new Err( e.message, e, {file: context.input.file, text: context.input.text, start: nodeSrc.object.loc.start.pos, end: nodeSrc.object.loc.end.pos});
            }
           
            // 替换为内联svg标签节点
            nodeSvgTag && node.replaceWith(nodeSvgTag);
        });

    });

}());
