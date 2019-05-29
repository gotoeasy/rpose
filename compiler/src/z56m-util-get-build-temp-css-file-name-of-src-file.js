const bus = require('@gotoeasy/bus');

bus.on('组件目标临时CSS文件名', function(){

    return function(srcFile){

        let env = bus.at('编译环境');
        let pkg = bus.at('文件所在模块', srcFile);
        if ( pkg === '/' ) {
            let file = srcFile.substring(env.path.src.length, srcFile.length-6) + '.css';
            return `${env.path.build_temp}${file}`;
        }else{
            let prjCtx = bus.at('项目配置处理', srcFile);
            let file = srcFile.substring(prjCtx.path.src.length, srcFile.length-6) + '.css';
            return `${env.path.build_temp}/node_modules/${pkg}${file}`;
        }
    };

}());
