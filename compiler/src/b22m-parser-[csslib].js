const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('解析[csslib]', function(){

    return function parseCsslib(csslib, context, loc){
        let rs = {};
        let lines = (csslib == null ? '' : csslib.trim()).split('\n');

        for ( let i=0,line; i<lines.length; i++ ) {
            line = lines[i];
            let key, value, idx = line.indexOf('=');                    // libname = npmpkg : filter, filter, filter
            if ( idx < 0) continue;

            key = line.substring(0, idx).trim();
            value = line.substring(idx+1).trim();

            idx = value.lastIndexOf('//');
            idx >= 0 && (value = value.substring(0, idx).trim());       // 去注释，无语法分析，可能会误判

            if ( !key ) {
                throw new Err('use * as empty csslib name. etc. * = ' + value, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 })
            }

            if ( rs[key] ) {
                throw new Err('duplicate csslib name: ' + key, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 })
            }
            rs[key] = value;
        }

        return rs;
    }


}());
