const bus = require('@gotoeasy/bus');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const hash = require('@gotoeasy/hash');
const browserslist = require('browserslist');

bus.on('browserslist', function(){
    
    return function(){
        let rs = browserslist();         // 默认
        return hash(rs.join('\n'));
    };

}());

