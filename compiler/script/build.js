const File = require('@gotoeasy/file');
const csjs = require('@gotoeasy/csjs');

    let fileIndex = File.resolve(__dirname, '../index.js');

    let ary = [];
    let files = File.files(File.path(fileIndex), 'src/**.js');
    files.sort();
            
    ary.push("console.time('load');");

    files.forEach(f => {
        let name = File.name(f);
        let src = File.read(f);
        if ( name !== 'all' ) {
            ary.push(`/* ------- ${name} ------- */`);
            ary.push('(() => {');
            ary.push(`// ------- ${name} start`);
            ary.push(`  ${src.replace(/\/\*\*\/__filename\/\*\*\//g, "'" + name + "'")}`);
            ary.push(`// ------- ${name} end`);
            ary.push('})();');
            ary.push('');
        }
    });

    ary.push("console.timeEnd('load');");

    let indexJs = File.read(File.resolve(__dirname, '../index.js'));
    indexJs = indexJs.replace('console.time', '/*\r\nconsole.time');
    indexJs = indexJs.replace('async', '*/\r\nasync');
    ary.push(`/* ------- index ------- */`);
    ary.push(indexJs);


    let js = ary.join('\r\n');
    js = csjs.formatJs(js, true);
//    js = csjs.miniJs(js);


    File.write(File.path(fileIndex) + '/compiler.js', js);

