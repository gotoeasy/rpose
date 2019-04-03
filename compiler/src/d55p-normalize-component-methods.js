const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const csjs = require('@gotoeasy/csjs');
const File = require('@gotoeasy/file');
const hash = require('@gotoeasy/hash');
const acorn = require('acorn');
const astring = require('astring');

bus.on('编译插件', function(){
    
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let script = context.script;

        root.walk( 'RposeBlock', (node, object) => {

            if ( !/^methods$/.test(object.name.value) ) return;

            let methods = object.text ? object.text.value.trim() : '';
            if ( methods ) {
                let rs = generateMethods(methods, object.text.loc);
                script.methods = rs.src;
//                script.$methodkeys = rs.names;
            }
            node.remove();
            return false;

        });

    });

}());



// 把对象形式汇总的方法转换成组件对象的一个个方法，同时都直接改成箭头函数（即使function也不确认this，让this指向组件对象）
function generateMethods(methods, loc){

    let hashcode = hash(methods);
    let cachefile = `${bus.at('缓存目录')}/normalize-methods/${hashcode}.js`;
    if ( File.existsFile(cachefile) ) return JSON.parse(File.read(cachefile));



    let code = `oFn               = ${methods}`;
    let ast;
    try{
        ast = acorn.parse(code, {ecmaVersion: 10, sourceType: 'module', locations: true} );
    }catch(e){
        // 通常是代码有语法错误
        throw new Err('syntax error in [methods]', e);
        // TODO
    }

    let map = new Map();

    let properties = ast.body[0].expression.right.properties;
    properties && properties.forEach(node => {
        if ( node.value.type == 'ArrowFunctionExpression' ) {
            map.set(node.key.name, 'this.' + node.key.name + '=' + astring.generate(node.value))
        }else if ( node.value.type == 'FunctionExpression' ) {
            // 为了让this安全的指向当前组件对象，把普通函数转换为箭头函数，同时也可避免写那无聊的bind(this)
            let arrNode = node.value;
            arrNode.type = 'ArrowFunctionExpression';
            map.set(node.key.name, 'this.' + node.key.name + '=' + astring.generate(arrNode))
        }
    });

    let names = [...map.keys()];
    names.sort();

    let rs = {src:'', names: names};
    names.forEach(k => rs.src += (map.get(k)+'\n'));

    File.write(cachefile, JSON.stringify(rs));
    return rs;
}
