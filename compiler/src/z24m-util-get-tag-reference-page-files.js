const bus = require('@gotoeasy/bus');

bus.on('组件相关页面源文件', function(){

    return (...srcFiles) => {

        let pageFiles = [];
        srcFiles.forEach(file => {
            let context = bus.at('组件编译缓存', file);
            if ( context && context.result && context.result.isPage ) {
                pageFiles.push(file);
            }

            pageFiles.push( ...getRefPages(file) );
        });
        return [...new Set(pageFiles)];

    };

}());


// 项目范围内，取组件相关的页面源文件
function getRefPages(srcFile){

    let refFiles = [];
    let tag = bus.at('标签全名', srcFile);
    if ( tag ) {
        let oFiles = bus.at('源文件对象清单');
        for ( let file in oFiles ) {
            let context = bus.at('组件编译缓存', file);
            if ( context && context.result && context.result.isPage ) {
                let allreferences = context.result.allreferences || [];
                allreferences.includes(tag) && refFiles.push(file);
            }
        }
    }
    return refFiles;

}
