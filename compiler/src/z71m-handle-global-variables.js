const bus = require('@gotoeasy/bus');
const Err = require('@gotoeasy/err');
const parser = require('@babel/parser');
const traverse = require("@babel/traverse").default;

bus.on('检查未定义变量', function(ast, input, PosOffset){
    
    traverse(ast, {
        Identifier(path) {

            if (isPrivateName(path)) return;                                                // 使用私有字段或方法时，不检查
            if (isClassMethod(path)) return;
            if (isClassProperty(path)) return;

            if (isInMemberExpression(path)) return;
            if (isObjectPropertyName(path)) return;
            if (isParamToCatchClause(path)) return;
            if (hasBinding(path)) return;

            if ( !bus.at('是否有效的全局变量名', path.node.name) ) {
                throw new Err(`undefine variable (${path.node.name})`, {...input, start: path.node.start + PosOffset, end: path.node.end + PosOffset});
            }
        }
    });

});

bus.on('查找未定义变量', function(code){
    
    let oSetGlobalVars = new Set();
    let ast = parser.parse(code, {sourceType: "module",
                plugins: [
                    "decorators-legacy",                                                    // 支持装饰器
                    "classProperties",                                                      // 支持类变量
                    "classPrivateProperties",                                               // 支持类私有变量
                    "classPrivateMethods",                                                  // 支持类私有方法
                ]
            });

    traverse(ast, {
        Identifier(path) {

            if (isPrivateName(path)) return;                                                // 使用私有字段或方法时，不检查
            if (isClassMethod(path)) return;
            if (isClassProperty(path)) return;

            if (isInMemberExpression(path)) return;
            if (isObjectPropertyName(path)) return;
            if (isParamToCatchClause(path)) return;
            if (hasBinding(path)) return;

            !bus.at('是否有效的全局变量名', path.node.name) && oSetGlobalVars.add(path.node.name);
        }
    });

    return [...oSetGlobalVars];
});


function isClassMethod(path) {
  return path.parentPath.isClassMethod();
}
function isClassProperty(path) {
  return path.parentPath.isClassProperty();
}
function isPrivateName(path) {
  return path.parentPath.isPrivateName();
}

function hasBinding(path) {
  let parent = path.findParent(path => path.isBlock() || path.isFunction());
  let noGlobals = true;
  return parent.scope.hasBinding(path.node.name, noGlobals);
}

function isParamToCatchClause(path) {
  let parent = path.findParent(path => path.isCatchClause());
  return !!parent && parent.node.param === path.node;
}

function isObjectPropertyName(path) {
  let parent = path.parentPath;
  if (parent.isObjectProperty()) {
    return !parent.node.computed && parent.node.key === path.node;
  }
  return false;
}

function isInMemberExpression(path) {
  let parent = path.parentPath;
  if (parent.isMemberExpression()) {
    return !parent.node.computed && parent.node.property === path.node;
  }
  return false;
}

