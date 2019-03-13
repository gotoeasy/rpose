const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');

bus.on('编译插件', function(){
    
    // 处理标签中的属性值
    //   --表达式时统一两边加小括号，便于后续直接当代码使用
    //   --字符串时统一转换为加双引号的单行字符串，便于后续直接当代码使用
    //   --数值时保持不变
    return postobject.plugin(__filename, function(root, context){

        root.walk( 'Attribute', (node, object) => {

            if ( /^\s*\{/.test(object.value) && /\}\s*/.test(object.value) && !/\\\}\s*/.test(object.value) ) {
                object.value = object.value.trim();
                object.value = object.value.substring(1, object.value.length-1);
                object.value.startsWith('=') && (object.value = object.value.substring(1));
                
                object.value = `(${object.value})`;

            }else if ( typeof object.value !== 'number' ) {
                object.value = '"' + lineString(object.value) + '"';       // 字符串时统一转换为加双引号的单行字符串
            }

        }, {readonly: true});

    });

}());


function lineString(str, quote = '"') {
    if ( str == null ) {
        return str;
    }

    let rs = str.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    if ( quote == '"' ) {
        rs = rs.replace(/"/g, '\\"');
    }else if ( quote == "'" ) {
        rs = rs.replace(/'/g, "\\'");
    }
    return rs;
}
