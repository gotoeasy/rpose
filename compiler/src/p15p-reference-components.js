const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){
        
        let result = context.result;
        let oSet = new Set();
        root.walk( 'Tag', (node, object) => {

            if ( !object.standard ) {
                oSet.add(object.value);

                let file = bus.at('标签源文件', object.value);
                if ( !file ) {
                    throw new Err('file not found of tag: ' + object.value, {file: context.input.file, text: context.input.text, start: object.loc.start.pos});
                }
            }

        }, {readonly: true});

        result.references = [...oSet];
    });

}());
