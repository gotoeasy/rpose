const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const File = require('@gotoeasy/file');

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
        return this.ary.join('\n');
    }
}


bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        context.writer = new JsWriter();

    });

}());
