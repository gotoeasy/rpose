const bus = require('@gotoeasy/bus');

bus.on('SVG转SYMBOL定义', function (){

    // text: 图标文件内容
    // symbolId: 定义用id
    // <svg viewBox="...">...</svg>    =>   <symbol id="..." viewBox="...">...</symbol>
    return function svgToSymbol(text, symbolId){

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

}());

