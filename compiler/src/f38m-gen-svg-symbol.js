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
        let files = [ ...(context.result.inlinesymbols||[]) ];                      // 本页面，加了再说，避免遗漏
        allreferences.forEach(tagpkg => {
            let ctx = bus.at('组件编译缓存', bus.at('标签源文件', tagpkg));
            ctx.result.inlinesymbols && files.push(...ctx.result.inlinesymbols);
        });
        if ( !files.length ) {
            return '';
        }

        files = [...new Set(files)];
        files.sort();

        let rs = ['<svg style="display:none;">'];
        files.forEach(file => rs.push(svgToSymbol(file)) );                         // 需要适当的转换处理
        rs.push( '</svg>' );

        return rs.join('\n');
    }

}());

bus.on('生成项目SVG-SYMBOL文件', function (created, fileSymbol){

    // 指定目录中的svg全部合并，可在文件范围内动态引用
    return function(nocache){

        let env  = bus.at('编译环境');

        if ( nocache || !fileSymbol ) {
            let files = File.files(env.path.svgicons, '*.svg');
            files = [...new Set(files)];
            files.sort();

            let rs = ['<svg style="display:none;" xmlns="http://www.w3.org/2000/svg">'];
            files.forEach(file => rs.push(svgToSymbol(file)) );                         // 需要适当的转换处理
            rs.push( '</svg>' );

            let svg = rs.join('');
            let dir = env.path.build_dist + '/' + (env.path.build_dist_images ? (env.path.build_dist_images + '/') : '');
            fileSymbol = 'symbol-' + hash(svg) + '.svg';
            File.write(dir + fileSymbol, svg);
        }
        return fileSymbol;
    }

}());

bus.on('生成外部引用SVG-USE', function (){

    return function(id, props={}){
        let attrs = [];
        for ( let key in props ) {
            attrs.push(`${key}="${props[key]}"`);
        }
        return `<svg ${attrs.join(' ')}><use xlink:href="%svgsymbolfile%#${id}"></use></svg>`;
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

// <svg viewBox="...">...</svg>    =>   <symbol id="..." viewBox="...">...</symbol>
function svgToSymbol(file){

    let text = File.read(file), id = File.name(file);

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
//    svgstart = svgstart.replace(/\s+xmlns:xlink\s?=\s?".+?"/, '');                  // 删除 fill 属性，以便使用时控制 （path标签硬编码的就不管了）

    !viewBox && width && height && (viewBox = `0 0 ${width} ${height}`);            // 无 viewBox 且有 width、height 时，生成 viewBox

    // 设定 id、viewBox 属性，svg 替换为 symbol
    return `<symbol id="${id}" viewBox="${viewBox}" ${svgstart.substring(4)} ${svg.substring(0, svg.length-6)}</symbol>`;
}