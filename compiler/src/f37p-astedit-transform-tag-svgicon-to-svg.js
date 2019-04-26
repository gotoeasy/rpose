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
                    // 其他属性全部作为svg标签用属性看待，效果上等同内联svg标签中直接写属性，但viewbox属性除外，viewbox不支持修改以免影响svg大小
                    !/^viewbox$/i.test(name) && (oAttrs[nd.object.name] = nd.object.value);
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
                // 指定NPM包中文件的形式
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
                let files = File.files(oPkg.path, filter);
                if ( !files.length ) {
                    throw new Err('svf icon file not found in package: ' + pkg, errLocInfo);                // npm包安装目录内找不到指定的图标文件
                }
                if ( files.length > 1 ) {
                    throw new Err('multi svf icon file found in package: ' + pkg, files, errLocInfo);       // npm包安装目录内找不到指定的图标文件
                }
                svgfile = files[0];     // 找到唯一的一个文件

            }else{
                // 项目目录范围内指定文件的形式
                filter = propSrc.trim();

                let env = bus.at('编译环境');
                let files = File.files(env.path.root, filter, '!/node_modules/**', '!/build/**');        // TODO 项目目录
                if ( !files.length ) {
                    throw new Err('svf icon file not found', errLocInfo);                                   // 项目范围内找不到指定的图标文件
                }
                if ( files.length > 1 ) {
                    throw new Err('multi svf icon file found', files, errLocInfo);                          // 项目范围内找不到指定的图标文件
                }
                svgfile = files[0];     // 找到唯一的一个文件
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
