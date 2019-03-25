const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('解析[taglib]', function(){

    return function parseTaglib(taglibBlockText, context, loc){
        let rs = {};
        let lines = (taglibBlockText == null ? '' : taglibBlockText.trim()).split('\n');
        for ( let i=0,line,oPkg; i<lines.length; i++ ) {
            line = lines[i];
            let key, value, idx = line.indexOf('=');                    // ui-button = @rpose/ui-button:ui-button
            if ( idx < 0) continue;

            key = line.substring(0, idx).trim();
            value = line.substring(idx+1).trim();

            idx = value.lastIndexOf('//');
            idx >= 0 && (value = value.substring(0, idx).trim());       // 去注释，无语法分析，可能会误判

            if ( !key ) {
                throw new Err('missing tag name. etc. tag-name = ' + value, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 });
            }

            if ( /^(if|for)$/i.test(key) ) {
                throw new Err('can not use buildin tag name: ' + key, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 });
            }

            if ( rs[key] ) {
                throw new Err('duplicate tag name: ' + key, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 });
            }

            let ary = value.split(':');
            let pkg = ary[0].trim();
            let install = bus.at('自动安装', pkg);
            if ( !install ) {
                throw new Err('package install failed: ' + pkg, { file: context.input.file, text: context.input.text, line: loc.start.line + i, column: 1 });
            }

            bus.at('标签库定义', `${key}=${value}`, context.input.file);

            rs[key] = value;
        }

        return rs;
    }


}());
