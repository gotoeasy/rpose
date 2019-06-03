const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 标签名统一小写
    return postobject.plugin(/**/__filename/**/, function(root){

        root.walk( 'Tag', (node, object) => {
            object.value = object.value.toLowerCase();
        });

    });

}());

