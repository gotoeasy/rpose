const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // FIXME: 第三方包组件别名，没有正确的在所属工程中找到源文件，新建【标签所属项目源文件】

    return postobject.plugin(/**/__filename/**/, function(root, context){
        
        let result = context.result;
        let oSet = new Set();
        root.walk( 'Tag', (node, object) => {

            if ( !object.standard && !/^@?(if|for|svgicon|router|router-link)$/i.test(object.value) ) {
                let file = bus.at('文件标签相应的源文件', object.value, context);
                if (!file) {
                    throw new Err('file not found of tag: ' + object.value, { ...context.input, start: object.pos.start });
                }
                let tagpkg = bus.at('标签全名', file);
                object.value = tagpkg;                          // 改成标签全名
                oSet.add(tagpkg);
            }

        }, {readonly: true});

        result.references = [...oSet];      // 依赖的组件【标签全名】
    });

}());
