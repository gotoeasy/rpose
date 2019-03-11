const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
	return postobject.plugin(__filename, function(root, result){

//        console.info('[000-log]', '-----------root JSON----------');
//        console.info('[000-log]', JSON.stringify(root,null,4));
    });

}());
