const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 转换处理指令节点 @for
    return postobject.plugin(__filename, function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( '@for', (node, object) => {

            let tagNode = node.parent;                                                      // 所属标签节点

            let type = OPTS.TypeCodeBlock;
            let value = parseFor(context, object);
            let loc = object.loc;
            let jsNode = this.createNode({type, value, loc});
            tagNode.before(jsNode);

            value = '}';
            jsNode = this.createNode({type, value, loc});
            tagNode.after(jsNode);
        });


    });

}());


// @for="value in array"
// @for={value in array}
// @for="(value, index) in array"
// @for={(value, index) in array}
function parseFor(context, object){

    if ( !object.value ) throw getError(context, object);                                                    // 格式错误

    let value, index, array;
    let match = object.value.match(/^\s*\{*\s*(\w+)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = '_J_';
        array = match[2];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        return ` for ( let ${index}=0,${value}; ${index}<${array}.length; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = '_J_';
        array = match[2];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        return ` for ( let ${index}=0,${value}; ${index}<${array}.length; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    match = object.value.match(/^\s*\{*\s*\(\s*(\w+),\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = match[2];
        array = match[3];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(index) ) throw getError(context, object, `invalid index name: [${index}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        return ` for ( let ${index}=0,${value}; ${index}<${array}.length; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    throw getError(context, object);                                                                         // 格式错误

}

function getError(context, object, msg='invalid format of @for'){
    // 格式错误
    return new Err(msg, {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
}
