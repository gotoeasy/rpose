const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('解析[csslib]', function(){

    return function parseCsslib(csslib, context, loc){
        let rs = {};
        let lines = (csslib == null ? '' : csslib.trim()).split('\n');
        let offsetLine = loc.start.line + 1;                            // [csslib]占了一行所以+1

        for ( let i=0,line; i<lines.length; i++ ) {
            line = lines[i];
            let key, value, pkg, idx = line.indexOf('=');               // key = pkg : filter, filter, filter
            if ( idx < 0) continue;

            key = line.substring(0, idx).trim();
            value = line.substring(idx+1).trim();

            idx = value.indexOf(':');
            pkg = idx > 0 ? value.substring(0, idx) : value;

            idx = value.lastIndexOf('//');
            idx >= 0 && (value = value.substring(0, idx).trim());       // 去注释，无语法分析，可能会误判

            if ( !key ) {
                throw new Err('use * as empty csslib name. etc. * = ' + value, { file: context.input.file, text: context.input.text, line: offsetLine + i });
            }

            if ( rs[key] ) {
                throw new Err('duplicate csslib name: ' + key, { file: context.input.file, text: context.input.text, line: offsetLine + i });
            }

            if ( !bus.at('自动安装', pkg) ) {
                throw new Err('package install failed: ' + pkg, { file: context.input.file, text: context.input.text, line: offsetLine + i });
            }

            rs[key] = value;
        }

        return rs;
    }


}());
