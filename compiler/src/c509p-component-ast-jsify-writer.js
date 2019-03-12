const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');
const csjs = require('@gotoeasy/csjs');
const Err = require('@gotoeasy/err');

class  JsWriter{

    constructor() {
        this.ary = [];
    }

    push (src){
        src !== undefined && this.ary.push(src);
    }

    write (src){
        src !== undefined && this.ary.push(src);
    }

    out (file){
        File.write(file, this.toString());
    }

    getArray (){
        return this.ary;
    }

    toString (){
        let js = this.ary.join('\n');
        try{
           // return csjs.formatJs( js );
            return csjs.formatJs( csjs.miniJs(js) );
        }catch(e){
            File.write(process.cwd() + '/build/error/format-error.js', js);
            throw e;
        }
    }
}


bus.on('编译插件', function(){
    
    return postobject.plugin(__filename, function(root, context){

        context.writer = new JsWriter();

    });

}());
