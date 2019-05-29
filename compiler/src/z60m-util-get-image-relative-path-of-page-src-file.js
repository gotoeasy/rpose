const bus = require('@gotoeasy/bus');

bus.on('页面图片相对路径', function(){

    return (srcFile) => {
        let env = bus.at('编译环境');
        let ary = srcFile.substring(env.path.src.length).split('/');
        let rs = '../'.repeat(ary.length-2) + env.path.build_dist_images;
        return (rs || '.') + '/';
    };

}());

