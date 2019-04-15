const bus = require('@gotoeasy/bus');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const browserslist = require('browserslist');

bus.on('browserslist', function(rs){
    
    return function(nocache){
        if ( nocache || !rs ) {
            let file = bus.at("编译环境").path.root + "/.browserslistrc";
            if ( File.existsFile(file) ) {
                let ary = [], lines = File.read(file).split(/\r?\n/);
                lines.forEach(line => {
                    line = line.trim();
                    line && !line.startsWith('#') && ary.push(line);
                });
                rs = hash(browserslist(ary).join('\n'));
            }else{
                rs = hash(browserslist().join('\n'));
            }
        }

        return rs;
    };

}());

