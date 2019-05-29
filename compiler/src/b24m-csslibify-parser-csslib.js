const bus = require('@gotoeasy/bus');

// 解析单个csslib定义，转换为对象形式方便读取
bus.on('解析csslib', function(){

    // file用于记录csslib所在文件，便于错误提示
    return function normalizeTaglib(csslib, file=''){

        let alias, pkg, filters = [], match;
        if ( (match = csslib.match(/^([\s\S]*?)=([\s\S]*?):([\s\S]*)$/)) ) {
            // alias=pkg:filters
            alias = match[1].trim();
            pkg = match[2].trim();
            match[3].split('//')[0].replace(/;/g, ',').split(',').forEach(filter => {       // 支持注释、支持逗号和分号分隔
                filter = filter.trim();
                filter && filters.push(filter);
            });
        }else if ( (match = csslib.match(/^([\s\S]*?)=([\s\S]*)$/)) ) {
            // alias=pkg
            alias = match[1].trim();
            pkg = match[2].trim();
            filters.push('**.min.css');                                                     // 默认取npm包下所有压缩后文件*.min.css
        }else if ( (match = csslib.match(/^([\s\S]*?):([\s\S]*)$/)) ) {
            // pkg:filters
            alias = '*';
            pkg = match[1].trim();
            match[2].split('//')[0].replace(/;/g, ',').split(',').forEach(filter => {       // 支持注释、支持逗号和分号分隔
                filter = filter.trim();
                filter && filters.push(filter);
            });
        }else{
            // pkg
            alias = '*';
            pkg = csslib.trim();
            filters.push('**.min.css');                                                     // 默认取npm包下所有压缩后文件*.min.css
        }

        if ( !pkg || !alias || /[:=/\s]+/.test(alias) ) {
            return null;                                                                    // 无包名，或写等号又漏写别名，或别名中包含冒号等号斜杠空格，都当做格式有误处理
        }

        return {alias, pkg, filters, file};
    }

}());




