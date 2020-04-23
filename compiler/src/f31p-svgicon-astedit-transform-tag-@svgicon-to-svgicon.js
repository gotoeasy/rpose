const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // @svgicon -> svgicon
    return postobject.plugin(/**/__filename/**/, function(root){

        root.walk( 'Tag', (node, object) => {
            if ( /^@svgicon$/i.test(object.value) ) {
                object.value = 'svgicon';
            }
        });

    });

}());

