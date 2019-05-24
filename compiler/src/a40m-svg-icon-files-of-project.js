const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

(function (svgFiles){

    bus.on('项目SVG图标文件列表', function(file){

        if ( !svgFiles ) {
            let dir = bus.at('项目配置处理', file).path.svgicons;
            svgFiles = File.files(dir, '**.svg');
            svgFiles.sort();
        }

        return svgFiles;
    });


})();

