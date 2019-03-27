const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // allreferences排序存放页面使用的全部组件的标签全名，便于生成页面js
    return postobject.plugin(__filename, function(root, context){
        if ( !context.result.isPage ) return false;         // 仅针对页面

        let oSetAllRef = new Set();
        let oStatus = {};
        let references = context.result.references;
        references.forEach(tagpkg => {
            addRefComponent(tagpkg, oSetAllRef, oStatus);
        });

        // 自身循环引用检查
        if ( oSetAllRef.has(context.result.tagpkg) ) {
            throw new Err('circular reference: ' + context.result.tagpkg);
        }

        // 排序便于生成统一代码顺序
        let allreferences = [...oSetAllRef];
        allreferences.sort();
        // 本页面固定放最后
        allreferences.push(context.result.tagpkg);

        context.result.allreferences = allreferences;
        
    });

}());

        

// tagpkg: 待添加依赖组件
function addRefComponent(tagpkg, oSetAllRequires, oStatus){
    if ( oStatus[tagpkg] ) {
        return;
    }

    oSetAllRequires.add(tagpkg);
    oStatus[tagpkg] = true;

    let srcFile = bus.at('标签源文件', tagpkg);
    let context = bus.at('编译组件', srcFile);  // 有缓存
    let references = context.result.references;
    references.forEach(subTagpkg => {
        addRefComponent(subTagpkg, oSetAllRequires, oStatus);
    });

}