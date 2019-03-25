const Err = require('@gotoeasy/err');
const bus = require('@gotoeasy/bus');
const hash = require('@gotoeasy/hash');
const postcss = require('postcss');
const tokenizer = require('css-selector-tokenizer');

bus.on('组件样式类名哈希化', function(){
    
    return function (srcFile, css){

        let fnPostcssPlugin = (root, result) => {

            root.walkRules( rule => {
                let ast = tokenizer.parse(rule.selector);
                let nodes = ast.nodes || [];
                nodes.forEach(node => {
                    if ( node.type === 'selector' ) {
                        (node.nodes || []).forEach(nd => {
                            if ( nd.type === 'class' ) {
                                nd.name = bus.at('哈希样式类名', srcFile, nd.name);
                            }
                        });
                    }
                });

                rule.selector = tokenizer.stringify(ast);
            });

        }

        let rs = postcss([fnPostcssPlugin]).process(css, {from: 'from.css'}).sync().root.toResult();

        return rs.css;
    }

}());


