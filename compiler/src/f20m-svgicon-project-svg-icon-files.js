const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

(function (){

    bus.on('项目SVG图标文件列表', function(file){

        let files = [];

        let prjCtx = bus.at('项目配置处理', file);
        let svgfiles = File.files(prjCtx.path.svgicons, '**.svg');

        // 图标目录
        let map = new Map();
        for ( let i=0,file,name,oFile; file=svgfiles[i++]; ) {
            name = File.name(file).toLowerCase();
            if ( map.has(name) ) {
                // 图标文件名重复（会导致不能按文件名显示确定的图标，应避免）
                throw new Error(`duplicate svg icon name (${name})\n  ${map.get(name).file}\n  ${file}`);
            }

            oFile = {name, file};
            map.set(name, oFile);
            files.push(oFile)
        }

        // 图标配置
        let names = Object.keys(prjCtx.result.oSvgicons);                                                                  // names本身没有重复名称，项目配置解析时已经检查
        for ( let i=0,name,oSvgicon,oFile; name=names[i++]; ) {
            oSvgicon = prjCtx.result.oSvgicons[name];
            if ( map.has(name) ) {
                // 图标名重复（会导致不能按图标名显示确定的图标，应避免）
                throw new Error(`duplicate svg icon name (${name})\n  ${map.get(name).file}\n  ${oSvgicon.svgicon}`, {...prjCtx.input, start: oSvgicon.pos.start, end: oSvgicon.pos.endAlias} );
            }

            oFile = {name, file: oSvgicon.file};
            map.set(name, oFile);
            files.push(oFile)
        }

        // 结果
        return {files, pkg: bus.at('文件所在模块', file)};

    });


})();

