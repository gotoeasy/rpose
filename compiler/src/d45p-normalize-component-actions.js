const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const acorn = require('acorn');
const astring = require('astring');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let script = context.script;

        root.walk( 'RposeBlock', (node, object) => {

            if ( !/^actions$/.test(object.name.value) ) return;

            let actions = object.text ? object.text.value.trim() : '';
            if ( actions ) {
                let rs = generateActions(actions, object.text.loc);
                script.actions = rs.src;
                script.$actionkeys = rs.names;
            }
            node.remove();
            return false;

        });

    });

}());




function generateActions(code, loc){

    let env = bus.at('编译环境');
    let oCache = bus.at('缓存');
    let catchKey = JSON.stringify(['generateActions', code]);
    if ( !env.nocache ) {
        let catchValue = oCache.get(catchKey);
        if ( catchValue ) return catchValue;
    }


    let rs;
    if ( code.startsWith('{') ) {
        rs = generateObjActions(code, loc);
    }else{
        rs = generateFunActions(code, loc);
    }

    return oCache.set(catchKey, rs);
}



function generateFunActions(code, loc){

    let ast;
    try{
        ast = acorn.parse(code, {ecmaVersion: 10, sourceType: 'module', locations: true} );
    }catch(e){
        // 通常是代码有语法错误
        throw new Err('syntax error in [actions]', e);
        // TODO
    //    throw new Err('syntax error in [actions] - ' + e.message, doc.file, {text, start});
    }

    let map = new Map();

    ast.body.forEach(node => {
        let nd;
        if ( node.type == 'FunctionDeclaration' ) {
            node.type = 'ArrowFunctionExpression';
            map.set(node.id.name, astring.generate(node));
        }else if ( node.type == 'VariableDeclaration' ) {
            nd = node.declarations[0].init;
            if ( nd.type == 'FunctionDeclaration' || nd.type == 'ArrowFunctionExpression' ) {
                nd.type = 'ArrowFunctionExpression';
                map.set(node.declarations[0].id.name, astring.generate(nd));
            }
        }else if ( node.type == 'ExpressionStatement' ) {
            nd = node.expression.right;
            if ( nd.type == 'FunctionDeclaration' || nd.type == 'ArrowFunctionExpression' ) {
                nd.type = 'ArrowFunctionExpression';
                map.set(node.expression.left.name, astring.generate(nd));
            }
        }
    });

    let names = [...map.keys()];
    let rs = {src:'', names: names};
    if ( names.length ) {
    //    names.sort();

        let ary = [];
        ary.push('this.$actions = {');
        names.forEach(k => {
            ary.push('"' + k + '": ' + map.get(k) + ',');
        });
        ary.push('}');
        
        rs.src = ary.join('\n');
    }

    return rs;
}

function generateObjActions(code, loc){
    let src = `this.$actions     = ${code}`;
    let ast;

    try{
        ast = acorn.parse(src, {ecmaVersion: 10, sourceType: 'module', locations: true} );
    }catch(e){
        // 通常是代码有语法错误
        throw new Err('syntax error in [actions]', e);
        // TODO
    //    throw new Err('syntax error in [actions] - ' + e.message, doc.file, {text, start});
    }

    let names = [];
    let properties = ast.body[0].expression.right.properties;
    properties && properties.forEach(node => {
        if ( node.value.type == 'ArrowFunctionExpression' ) {
            names.push(node.key.name);
        }else if ( node.value.type == 'FunctionExpression' ) {
            // 为了让this安全的指向当前组件对象，把普通函数转换为箭头函数，同时也可避免写那无聊的bind(this)
            let nd = node.value;
            nd.type = 'ArrowFunctionExpression';
            names.push(node.key.name);
        }
    });

    let rs = {src:'', names: names};
    if ( names.length ) {
        names.sort();
        rs.src = astring.generate(ast);
    }

    return rs;
}