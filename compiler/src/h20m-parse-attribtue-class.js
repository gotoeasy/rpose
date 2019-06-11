const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');

// class="foo {bar: isBar, baz: isBaz}" => [ {Name: {value:'foo', start, end}, Expr: {value:1, start, end}},
//                                           {Name: {value:'bar', start, end}, Expr: {value:'isBar', start, end}},
//                                           {Name: {value:'baz', start, end}, Expr: {value:'isBaz', start, end}} ]
bus.on('解析CLASS属性', function(){

    // file, text 用于错误提示
    return function(file, text, classAttrValue, offset){

        if ( !classAttrValue.trim() ) return [];

        return parseToClasses(file, text, classAttrValue, offset);

    };

}());


function parseToClasses(file, text, strClass, offset){

    // 分割放入数组，并计算保存好偏移位置
    // foo {bar: isBar, baz: isBaz}  => [{value: 'foo', start: 0, end: xxx}, {value: '{bar: isBar, baz: isBaz}', start: xxx, end: xxx}]
    let ary = [];
    let clas = strClass.replace(/\{[\s\S]*?\}/g, function(sMatch, idx){
        ary.push({value: sMatch, start: offset + idx, end: offset + idx + sMatch.length});
        return '鬱'.repeat(sMatch.length);
    });
    clas.replace(/[\S]+/g, function(sMatch, idx){
        if ( !sMatch.startsWith('鬱') ) {
            ary.push({value: sMatch, start: offset + idx, end: offset + idx + sMatch.length});
        }
    });

    // 解析为单个类名对象
    let result = [];
    ary.forEach(v => {
        if ( v.value.startsWith('{') &&  v.value.endsWith('}') ) {
            result.push( ...parseExprClass(v, file, text) );
        }else{
            result.push( parseSingleClass(v, file, text) );
        }
    });

    // 类名重复性检查
    let map = new Map();
    for ( let i=0,oItem; oItem=result[i++]; ) {
        if ( map.has(oItem.Name.value) ) {
            throw new Err(`duplicate class name (${oItem.Name.value})`, { file, text, ...map.get(oItem.Name.value).Name }, { file, text, ...oItem.Name });
        }
        map.set(oItem.Name.value, oItem);
    }

    // 返回解析结果
    return result;
}

// 解析单个类名
function parseSingleClass(oClas, file, text){

    // 简单检查类名
    if ( /[/:{}\\,]/.test(oClas.value)  ) {
        throw new Err('invalid format of class attribute', {file, text, ...oClas});
    }

    return { Name: oClas, Expr: {value: 1, start: oClas.start, end: oClas.end} }
}

// 解析N个表达式类名
function parseExprClass(oClas, file, text){
    let sClas = oClas.value.replace(/,?\s*\}$/, '');     // 删除后面大括号，以及可能的冗余逗号 （开头大括号不删除，以不影响偏移计算）

    // 简单检查
    if ( sClas.indexOf(':') < 0 ) {
        throw new Err('invalid format', {file, text, start: oClas.start, end: oClas.end});
    }

    // 解析出样式类名及位置信息
    // {foo: expr1, bar: expr2 => [{name: 'foo', start: 0, end: 3}, {name: 'bar', start: nnn, end: nnn}]
    // {foo: expr1, bar: expr2 => 鬱鬱鬱鬱鬱 expr1鬱鬱鬱鬱鬱 expr2
    let names = [];
    sClas = sClas.replace(/^{\s*(\S+?\s*:)|,\s*(\S+?\s*:)/g, function(sMatch, name1, name2, idx){

        let matchName = name1 || name2;                                             // [foo :]
        let value = matchName.replace(/\s*:$/, '');                                 // [foo :] => [foo]
        let start = oClas.start + idx + (sMatch.length - matchName.length);        // 样式类名foo的起始位置
        let end = start + value.length;                                             // 样式类名foo的结束位置

        names.push({value, start, end});                                            // 保存样式类名及位置信息

        return '鬱'.repeat(sMatch.length);                                          // 用等长特殊字符替换以保持位置信息不变
    });

    // 解析出表达式及位置信息
    // 鬱鬱鬱鬱鬱 expr1鬱鬱鬱鬱鬱 expr2 => [{expr: ' expr1', start: nnn, end: nnn}, {expr: ' expr2', start: nnn, end: nnn}]
    let exprs = [];
    sClas.replace(/[^鬱]+/g, function(sMatch, idx){

        let value = sMatch.trim();
        let start = oClas.start + idx + (sMatch.length - sMatch.trimStart().length);
        let end = start + sMatch.trimEnd().length;

        exprs.push({value, start, end});
    });

    // 检查长度是否一致
    if ( names.length != exprs.length ) {
        throw new Err('invalid format', {file, text, start: oClas.start, end: oClas.end});
    }
    // 检查样式名（不能有空格）
    for ( let i=0,oItem; oItem=names[i++]; ) {
        if ( /\s+/.test(oItem.value) ) {
            throw new Err(`invalid class name [${oItem.value}]`, {file, text, start: oItem.start, end: oItem.end});
        }
    }
    // 检查表达式（不能为空）
    for ( let i=0,oItem; oItem=exprs[i++]; ) {
        if ( !oItem.value.trim() ) {
            throw new Err(`invalid class expression`, {file, text, start: oItem.start, end: oItem.end});
        }
    }

    // 整理结果
    let rs = [];
    for ( let i=0; i < names.length; i++ ) {
        rs.push({ Name: names[i], Expr: exprs[i] });
    }
    return rs;

}
