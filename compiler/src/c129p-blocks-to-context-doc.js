const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
	return postobject.plugin(__filename, function(root, context){

        let doc = context.doc;

        root.walk( 'RposeBlock', (node, object) => {

            // 指定块存放到context中以便于读取，节点相应删除
            if ( /^(api|mount)$/.test(object.name.value) ) {
                doc[object.name.value] = object.text ? object.text.value : '';
                node.remove();
            }
        });

    });

}());

