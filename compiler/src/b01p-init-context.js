const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 解析rpose源文件，替换树节点（单个源文件的单一节点），输入{file，text}
    return postobject.plugin(/**/__filename/**/, function(root, context){

        context.input = {};                 // 存放原始输入（file、text）
        context.doc = {};                   // 存放源文件的中间解析结果
        context.style = {};                 // 存放样式的中间编译结果
        context.script = {};                // 存放脚本的中间编译结果，script的Method属性存放方法名为键的对象
        context.keyCounter = 1;             // 视图解析时标识key用的计数器（同一组子节点单位内递增）

        context.result = {};                // 存放编译结果


        // 保存原始输入（file、text）
        root.walk( (node, object) => {
            context.input.file = object.file
            context.input.text = object.text;
            context.input.hashcode = object.hashcode;
        }, {readonly: true});

//console.info('compile ..........', context.input.file);

    });

}());

