const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');

bus.on('生成内联SVG-SYMBOL代码', function (){

    // 前提: 页面编译成功，使用到的关联组件全部编译成功
    // 最后生成页面时调用此模块，生成内联svg-symbol
    return function(pageSrcFile){

        let context = bus.at('组件编译缓存', pageSrcFile);
        let allreferences = context.result.allreferences;

        // 取出页面使用到的内联svg，去除重复，排序后生成svg-symbol方式的字符串
        let files = [ ...(context.result.inlinesymbols||[]) ];                                          // 本页面，加了再说，避免遗漏
        allreferences.forEach(tagpkg => {
            let ctx = bus.at('组件编译缓存', bus.at('标签源文件', tagpkg, context.result.oTaglibs));
            ctx.result.inlinesymbols && files.push(...ctx.result.inlinesymbols);
        });
        if ( !files.length ) {
            return '';
        }

        files = [...new Set(files)];
        files.sort();

        let rs = ['<svg style="display:none;">'];
        let text, symbolId, oSetIds = new Set();
        files.forEach(file => {
            text = File.read(file);
            symbolId = hash(text);
            !oSetIds.has(symbolId) && rs.push(svgToSymbol(text, symbolId));                             // 需要适当的转换处理，使用文件内容哈希码作为id
            oSetIds.add(symbolId);
        });
        rs.push( '</svg>' );

        return rs.join('\n');
    }

}());

bus.on('生成项目SVG-SYMBOL文件', function (filename, fileshashcode, hashcode){

    // 指定目录中的svg全部合并，可在文件范围内动态引用
    return function(nocache){

        let env  = bus.at('编译环境');
        let files = File.files(env.path.svgicons, '*.svg');
//        files.push(...bus.at('外部SVG-SYMBOL使用的第三方包中的图标文件'));
        files.push(...bus.at('项目全体页面及关联组件中svgicon硬编码用到的图标文件'));
        files = [...new Set(files)];
        files.sort();
        let hashcd = hash(JSON.stringify(files));

        // TODO 文件名冲突
        if ( nocache || (hashcd !== fileshashcode) ) {
            fileshashcode = hashcd;
            let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
            let text, symbolId, oSetIds = new Set();
            files.forEach(file => {
                text = File.read(file);
                symbolId = File.name(file);
                !oSetIds.has(symbolId) && rs.push(svgToSymbol(text, symbolId));                         // 需要适当的转换处理，使用文件名作为id
                oSetIds.add(symbolId);
            });
            rs.push( '</svg>' );

            let svg = rs.join('');
            let dir = env.path.build_dist + '/' + (env.path.build_dist_images ? (env.path.build_dist_images + '/') : '');
            hashcode = hash(svg);                // 热刷新计算用
            filename = 'svg-symbols.svg';
            File.write(dir + filename, svg);
            console.info('[write] -',  dir + filename);
        }
        return {filename, hashcode};
    }

}());

bus.on('生成外部引用SVG-USE', function (){

    return function(exprOrFile, props={}){
        let attrs = [];
        for ( let key in props ) {
            attrs.push(`${key}="${props[key]}"`);
        }
        let href;
        if ( bus.at('是否表达式', exprOrFile) ) {
            let expr = exprOrFile.substring(1, exprOrFile.length-1);
            href = `{'%svgsymbolfile%#' + (${expr}) }`;
        }else{
            let name = File.name(exprOrFile);                                                           // 使用文件名作为id （TODO 冲突）
            href = `%svgsymbolfile%#${name}`;
        }
        return `<svg ${attrs.join(' ')}><use xlink:href="${href}"></use></svg>`;
    }

}());

bus.on('生成内部引用SVG-USE', function (){

    return function(id, props={}){
        let attrs = [];
        for ( let key in props ) {
            attrs.push(`${key}="${props[key]}"`);
        }
        return `<svg ${attrs.join(' ')}><use xlink:href="#${id}"></use></svg>`;
    }

}());

// text: 图标文件内容
// <svg viewBox="...">...</svg>    =>   <symbol id="..." viewBox="...">...</symbol>
function svgToSymbol(text, symbolId){

    let svg, match;
    match = text.match(/<svg\s+[\s\S]*<\/svg>/);                                    // 从文件内容中提取出svg内容 （<svg>...</svg>）
    if ( !match ) return '';
    svg = match[0];

    let svgstart;
    svg = svg.replace(/<svg\s+[\s\S]*?>/, function(mc){                             // 不含开始标签的svg内容
        svgstart = mc;                                                              // svg开始标签
        return '';
    });

    let width, height, viewBox = '';
    svgstart = svgstart.replace(/\s+width\s?=\s?"(.+?)"/, function(mc, val){        // 删除 width 属性
        width = val;
        return '';
    });
    svgstart = svgstart.replace(/\s+height\s?=\s?"(.+?)"/, function(mc, val){       // 删除 height 属性
        height = val;
        return '';
    });
    svgstart = svgstart.replace(/\s+viewBox\s?=\s?"(.+?)"/, function(mc, val){      // 删除 viewBox 属性
        viewBox = val;
        return '';
    });
    svgstart = svgstart.replace(/\s+id\s?=\s?".+?"/, '');                           // 删除 id 属性
    svgstart = svgstart.replace(/\s+fill\s?=\s?".+?"/, '');                         // 删除 fill 属性，以便使用时控制 （path标签硬编码的就不管了）
    svgstart = svgstart.replace(/\s+xmlns\s?=\s?".+?"/, '');                        // 删除 xmlns 属性

    !viewBox && width && height && (viewBox = `0 0 ${width} ${height}`);            // 无 viewBox 且有 width、height 时，生成 viewBox

    // 设定 id、viewBox 属性，svg 替换为 symbol
    return `<symbol id="${symbolId}" viewBox="${viewBox}" ${svgstart.substring(4)} ${svg.substring(0, svg.length-6)}</symbol>`;
}

bus.on('项目全体页面及关联组件中svgicon硬编码用到的图标文件', function (){

    return function(){

        let oSetSvgFile = new Set();
        let oSetSrcFile = new Set();
        let oFiles = bus.at('源文件对象清单');
        for ( let file in oFiles ) {                                                                // 遍历项目中的全体组件
            let context = bus.at('组件编译缓存', file );
            if ( context && context.result && context.result.isPage) {

                (context.result.allrefsvgicons || []).forEach(f => oSetSvgFile.add(f));             // 当前页面组件中用到的存起来

                let allreferences = context.result.allreferences || [];
                for ( let i=0,tagpkg,srcFile,ctx; tagpkg=allreferences[i++]; ) {
                    if ( tagpkg.indexOf(':') > 0 ) {
                        srcFile = bus.at('标签源文件', tagpkg, context.result.oTaglibs);
                        ctx = bus.at('组件编译缓存', srcFile );
                        if ( ctx ) {
                            if ( oSetSrcFile.has(srcFile) ) continue;                               // 避免重复添加，提高点性能
                            oSetSrcFile.add(srcFile);
                            (ctx.result.allrefsvgicons || []).forEach(f => oSetSvgFile.add(f));     // 页面关联组件中用到的存起来
                        }
                    }
                }
            }
        }

        return oSetSvgFile;
    }

}());

bus.on('外部SVG-SYMBOL使用的第三方包中的图标文件', function (){

    // 本项目页面关联的第三方组件如果使用了外部SVG-SYMBOL
    // 则打包该组件所在项目的SVG图标目录中的全部图标文件
    return function(){

        let oSetPackageFile = new Set();                                            // 使用了外部SVG-SYMBOL的第三方包的项目配置文件
        let oFiles = bus.at('源文件对象清单');
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file );
            if ( context && context.result && context.result.isPage) {
                let allreferences = context.result.allreferences || [];
                for ( let i=0,tagpkg,srcFile,ctx; tagpkg=allreferences[i++]; ) {
                    if ( tagpkg.indexOf(':') > 0 ) {
                        srcFile = bus.at('标签源文件', tagpkg, context.result.oTaglibs);
                        ctx = bus.at('组件编译缓存', srcFile );
                        if ( ctx && ctx.result && ctx.result.hasRefSvgSymbol ) {
                            oSetPackageFile.add( bus.at('文件所在项目配置文件', srcFile) );
                        }
                    }
                }
            }
        }

        let files = [];
        oSetPackageFile.forEach(file => {
            let oPjtContext = bus.at('项目配置处理', file);
            files.push(...File.files(oPjtContext.path.svgicons, '**.svg'));
        });

        return files;
    }

}());

bus.on('页面是否引用外部SVG-SYMBOL文件', function (){

    return function(srcFile){

        let context = bus.at('组件编译缓存', srcFile);
        if ( !context || !context.result || !context.result.isPage ) {
            return false;                                                           // 不是页面
        }

        if ( context.result.hasRefSvgSymbol ) {
            return true;                                                            // 页面有使用
        }

        let allreferences = context.result.allreferences || [];
        for ( let i=0,tagpkg,srcFile,ctx; tagpkg=allreferences[i++]; ) {
            srcFile = bus.at('标签源文件', tagpkg, context.result.oTaglibs);
            ctx = bus.at('组件编译缓存', srcFile );
            if ( ctx && ctx.result && ctx.result.hasRefSvgSymbol ) {
                return true;                                                        // 页面关联组件有使用
            }
        }

        return false; // 没使用或没编译通过
    }

}());

