const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        
        let result = context.result;
        let oSet = new Set();
        root.walk( 'Tag', (node, object) => {

            if ( !object.standard && !/^@?(if|for)$/i.test(object.value) ) {
                let file = bus.at('标签源文件', object.value, context.result.oTaglibs);
                if ( !file ) {
                    if (/^@/i.test(object.value)) {
                        // @tag可指所在工程同名组件，找找看
                        file = bus.at('标签项目源文件', object.value.substring(1));
                        file && (object.value = object.value.substring(1));                 // 找到，暴力修改标签名。。。FIXME 优雅点
                    }

                    if (!file) {
                        throw new Err('file not found of tag: ' + object.value, { ...context.input, start: object.pos.start });
                    }
                }
                let tagpkg = bus.at('标签全名', file);
                oSet.add(tagpkg);
            }

        }, {readonly: true});

        result.references = [...oSet];      // 依赖的组件【标签全名】
    });

}());
