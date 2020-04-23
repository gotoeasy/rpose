const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 针对特定的内置标签组件更换标签全名
    return postobject.plugin(/**/__filename/**/, function(root){

        root.walk( 'Tag', (node, object) => {
            if ( object.standard ) return;
            
            if ( /^@?router$/i.test(object.value) ){
                object.value = '@rpose/buildin:router';
            }
            if ( /^@?router-link$/i.test(object.value) ){
                object.value = '@rpose/buildin:router-link';
            }

        });
    
    }, {readonly: true});

}());

