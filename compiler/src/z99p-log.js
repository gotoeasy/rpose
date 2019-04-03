const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, result){

//        console.info('[999-log]', '-----------root JSON----------');
//        console.info(JSON.stringify(root,null,4));
//        console.info('[999-log]', '-----------result JSON----------');
//        console.info(JSON.stringify(result,null,4));
//        console.info('[999-log]', '--------------------------------');
   });

}());
