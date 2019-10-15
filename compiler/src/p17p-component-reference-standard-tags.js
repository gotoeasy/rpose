const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        
        let result = context.result;
        let oSet = new Set();
        root.walk( 'Tag', (node, object) => {

            if ( object.standard ) {
                oSet.add(object.value);
            }

        }, {readonly: true});

        result.standardtags = [...oSet];
    });

}());
