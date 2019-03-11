const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
	return postobject.plugin(__filename, function(root, context){

        if ( !context.result.isPage ) return false;         // 仅针对页面

        let oSetAllRef = new Set();
        let oStatus = {};
        let references = context.result.references;
        references.forEach(tagpkg => {
            addRefComponent(tagpkg, oSetAllRef, oStatus);
        });

        // 排序便于生成统一代码顺序，本页面固定最后
        oSetAllRef.delete(context.result.tagpkg);
        let allreferences = [...oSetAllRef];
        allreferences.sort();
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
