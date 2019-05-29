const bus = require('@gotoeasy/bus');

bus.on('页面目标HTML文件名', function(){

    return function(srcFile){
        let env = bus.at('编译环境');
        return env.path.build_dist + srcFile.substring(env.path.src.length, srcFile.length-6) + '.html'; 
    };

}());
