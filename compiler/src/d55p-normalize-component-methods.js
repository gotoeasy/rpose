const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let script = context.script;

        root.walk( 'RposeBlock', (node, object) => {

            if ( !/^methods$/.test(object.name.value) ) return;

            let methods = object.text ? object.text.value : '';
            if ( methods ) {
                let rs = bus.at('解析检查METHODS块并删除装饰器', methods, context.input, object.text.pos.start); // 传入[methods]块中的代码，以及源文件、偏移位置
                Object.assign(script, rs);
            }
            node.remove();
            return false;

        });

    });

}());

