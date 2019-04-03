const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');

bus.on('编译插件', function(){
    
    // 转换处理指令节点 @for
    return postobject.plugin(/**/__filename/**/, function(root, context){

        const OPTS = bus.at('视图编译选项');

        root.walk( '@for', (node, object) => {

            let tagNode = node.parent;                                                      // 所属标签节点
            /^for$/i.test(tagNode.object.value) && (tagNode.ok = true);

            let type = OPTS.TypeCodeBlock;
            let value = parseFor(context, object);
            let loc = object.loc;
            let jsNode = this.createNode({type, value, loc});
            tagNode.before(jsNode);

            value = '}';
            jsNode = this.createNode({type, value, loc});
            tagNode.after(jsNode);

            node.remove();
        });


    });

}());


// @for="value in array"
// @for="(value, index) in array"
// @for="(value, index from i) in array"
// @for="(value, index max m) in array"
// @for="(value, index from i max m) in array"
// @for="(value, index max m from i) in array"
function parseFor(context, object){

    if ( !object.value ) throw getError(context, object);                                                    // 格式错误

    let value, index, from, max, array, match;

    // @for={(value, index from i max m) in array}
    match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+from\s+(\w+)\s+max\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = match[2];
        from = match[3];
        max = match[4];
        array = match[5];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(index) ) throw getError(context, object, `invalid index name: [${index}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        if ( /[^a-zA-Z\d_]/.test(array) ) {
            return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
        }
        return ` for ( let ${index}=${from},MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    // @for={(value, index max m from i) in array}
    match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+max\s+(\w+)\s+from\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = match[2];
        from = match[4];
        max = match[3];
        array = match[5];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(index) ) throw getError(context, object, `invalid index name: [${index}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        if ( /[^a-zA-Z\d_]/.test(array) ) {
            return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
        }
        return ` for ( let ${index}=${from},MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    // @for={(value, index from i) in array}
    match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+from\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = match[2];
        from = match[3];
        array = match[4];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(index) ) throw getError(context, object, `invalid index name: [${index}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        if ( /[^a-zA-Z\d_]/.test(array) ) {
            return ` for ( let ${index}=${from},ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
        }
        return ` for ( let ${index}=${from},MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    // @for={(value, index max m) in array}
    match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s+max\s+(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = match[2];
        max = match[3];
        array = match[4];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(index) ) throw getError(context, object, `invalid index name: [${index}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        if ( /[^a-zA-Z\d_]/.test(array) ) {
            return ` for ( let ${index}=0,ARY_=(${array}),MAX_=Math.min(${max},ARY_.length),${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
        }
        return ` for ( let ${index}=0,MAX_=Math.min(${max},${array}.length),${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    // @for={(value, index) in array}
    match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = match[2];
        array = match[3];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(index) ) throw getError(context, object, `invalid index name: [${index}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        if ( /[^a-zA-Z\d_]/.test(array) ) {
            return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
        }
        return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    // @for={(value) in array}
    match = object.value.match(/^\s*\{*\s*\(\s*(\w+)\s*\)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = 'J_';
        array = match[2];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(index) ) throw getError(context, object, `invalid index name: [${index}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        if ( /[^a-zA-Z\d_]/.test(array) ) {
            return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
        }
        return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }

    // @for={value in array}
    match = object.value.match(/^\s*\{*\s*(\w+)\s+in\s+(\S+?)\s*\}*\s*$/);
    if ( match ) {
        value = match[1];
        index = 'J_';
        array = match[2];
        if ( /^\d+/.test(value) ) throw getError(context, object, `invalid value name: [${value}]`);         // 变量名错误
        if ( /^\d+/.test(array) ) throw getError(context, object, `invalid array name: [${array}]`);         // 变量名错误

        if ( /[^a-zA-Z\d_]/.test(array) ) {
            return ` for ( let ${index}=0,ARY_=(${array}),MAX_=ARY_.length,${value}; ${index}<MAX_; ${index}++) {
                        ${value} = ARY_[${index}]; `;
        }
        return ` for ( let ${index}=0,MAX_=${array}.length,${value}; ${index}<MAX_; ${index}++) {
                    ${value} = ${array}[${index}]; `;
    }


    throw getError(context, object);                                                                         // 格式错误

}

function getError(context, object, msg='invalid format of @for'){
    // 格式错误
    return new Err(msg, {file: context.input.file, text: context.input.text, start: object.loc.start.pos, end: object.loc.end.pos});
}
