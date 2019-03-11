const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
	return postobject.plugin(__filename, function(root, context){

        root.walk( 'RposeBlock', (node, object) => {

            if ( !/^view$/.test(object.name.value) ) return;

            let view = object.text ? object.text.value : '';
            if ( !view ) return node.remove();

            let tokenParser = bus.at('视图TOKEN解析器', context.input.text, view, context.input.file, object.text.loc.start.pos);
            let type = 'View';
            let src = view;
            let loc = object.text.loc;
            let nodes = tokenParser.parse();
            let objToken = {type, src, loc, nodes};

            let nodeToken = this.createNode(objToken);
            node.replaceWith(nodeToken);
        });

    });

}());

