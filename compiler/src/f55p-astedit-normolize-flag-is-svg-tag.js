const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 判断是否为SVG标签或SVG子标签，并加上标记
    return postobject.plugin(/**/__filename/**/, function(root, context){

        root.walk( 'Tag', (node, object) => {
            if ( !/^svg$/i.test(object.value) ) return;

            // 当前节点时SVG标签，打上标记
            object.svg = true;

            // 子节点都加上SVG标记
            node.walk( 'Tag', (nd, obj) => {
                obj.svg = true;
            }, {readonly:true});

        }, {readonly:true});

    });

}());
