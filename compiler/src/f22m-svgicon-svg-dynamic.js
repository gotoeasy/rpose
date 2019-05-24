const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');

bus.on('动态判断显示SVG标签', function (){

    return function(expr, srcFile){

        let files = bus.at('项目SVG图标文件列表', srcFile);
        if ( !files.length ) {
            let env = bus.at('编译环境');
            throw new Error(`no svg icon file in folder (${env.path.svgicons})`);
        }

        let texts = [], svg;
        files.forEach( file => {
            svg = File.read(file);
            expr = expr.replace(/^\s*{/, '(').replace(/}\s*$/, ')');
            svg = svg.replace('<svg ', `<svg @if={${expr} === '${File.name(file)}'} `);
           // svg = `<if @if={${expr} === '${File.name(file)}'}>${svg}</if>`;
           // svg = `{% if( ${expr} === '${File.name(file)}' ){ %} ${svg} {% } %}`;
            texts.push(svg);
        });

        return texts.join('\n');
    }

}());

