const bus = require('@gotoeasy/bus');
const postobject = require('@gotoeasy/postobject');
const Err = require('@gotoeasy/err');
const hash = require('@gotoeasy/hash');

const AryNm = '_Ary';
const SlotVnodes = 'slotVnodes';

bus.on('编译插件', function(){
    
    // 插槽标签slot的转换
    // 仅一个插槽时可以不起名，多个插槽时必须起名，且不能有重复
    // 存在插槽时，汇总插槽名存放于context.result.slots
    // 没有插槽时，无context.result.slots
    // 多个插槽时，数组context.result.slots中存放名称
    // 有插槽时，api的$state中添加插槽属性接口 $SLOT，以便差异渲染
    return postobject.plugin(/**/__filename/**/, function(root, context){

        let nonameSlotNodes = [];
        let options = bus.at('视图编译选项');

        root.walk( 'Tag', (node, object) => {
            if ( !/^slot$/i.test(object.value) ) return;

            let slots = context.result.slots = context.result.slots || [];

            // 查找Attributes
            let attrsNode;
            if ( node.nodes ) {
                for ( let i=0,nd; nd=node.nodes[i++]; ) {
                    if ( nd.type === 'Attributes' ) {
                        attrsNode = nd;
                        break;
                    }
                }
            }
            if ( !attrsNode || !attrsNode.nodes || !attrsNode.nodes.length ){
                // 无名slot，存在多个slot时必须指定name
                if ( slots.length ) {
                    throw new Err(`missing attribute 'name' of tag <slot>`, { ...context.input, ...object.pos });
                }
                slots.push('');
                nonameSlotNodes.push(node);                         // 暂存无名插槽
                node.slotName = '';
                return;
            }

            // 查找目标属性节点
            let ary = [];
            attrsNode.nodes && attrsNode.nodes.forEach(nd => {
                /^name$/i.test(nd.object.name) && ary.push(nd);     // 找到
            });
            if ( ary.length === 0 ){
                // 无名slot，存在多个slot时必须指定name
                if ( slots.length ) {
                    throw new Err(`missing attribute 'name' of tag <slot>`, { ...context.input, ...object.pos });
                }
                slots.push('');
                nonameSlotNodes.push(node);                         // 暂存无名插槽
                node.slotName = '';
                return;
            }
            if ( ary.length > 1 ){
                // 一个slot只能有一个name属性
                throw new Err('duplicate attribute of name', { ...context.input, ...ary[1].object.Name.pos });
            }

            if ( bus.at('是否表达式', ary[0].object.value) ) {
                // 插槽的属性 name 不能使用表达式
                throw new Err('slot name unsupport the expression', { ...context.input, ...ary[0].object.Value.pos });
            }

            let name = ary[0].object.value + '';
            if ( slots.includes(name) ){
                // slot不能重名
                throw new Err('duplicate slot name: ' + name, { ...context.input, ...ary[0].object.Value.pos });
            }

            slots.push(name);
            !name && nonameSlotNodes.push(node);                    // 暂存无名插槽
            node.slotName = name;
        });


        let slots = context.result.slots = context.result.slots || [];
        if ( slots.length > 1 && nonameSlotNodes.length ) {
            // 多个插槽时必须起名，且不能有重复
            throw new Err(`missing slot name on tag <slot>`, { ...context.input, ...nonameSlotNodes[0].object.pos });
        }

        if ( context.result.slots ) {
            // 有插槽时，api的statekeys中添加插槽属性接口 $SLOT，以便差异渲染
            let statekeys = context.doc.api.statekeys = context.doc.api.statekeys || [];
            !statekeys.includes('$SLOT') && statekeys.push('$SLOT');
        }


        // -------------------------------------------
        // 辅助代码生成
        if ( slots.length) {

            // 遍历插槽节点替换为代码块节点
            root.walk( 'Tag', (nd, obj) => {
                if ( !/^slot$/i.test(obj.value) ) return;

                let type = options.TypeCodeBlock;
                let value =  `${AryNm}.push( ...${SlotVnodes}_${hash(nd.slotName)} );`;     // _Ary.push(...(slotVnodes_xxxxx || []));
                nd.replaceWith( this.createNode({type, value}) );
            });


            // 根节点前插入代码块节点
            let arySrc = [];
            let isNoNameSlot = (slots.length === 1 && slots[0] === '') ? true : false;

            // 变量部分 let slotVnodes_xxxx, slotVnodes_xxxx;
            let aryVars = [];
            isNoNameSlot && aryVars.push(' _hasDefinedSlotTemplate ');     // 单一无名插槽时加一个判断标志
            slots.forEach(slotName => {
                aryVars.push( ` ${SlotVnodes}_${hash(slotName)} = [] ` );
            });
            arySrc.push( 'let ' + aryVars.join(',') + ';');

            arySrc.push( ` ($state.$SLOT || []).forEach(vn => { ` );
            arySrc.push( `     if (vn.a) { ` );
            if ( isNoNameSlot ) {
                arySrc.push( `     vn.a.slot !== undefined && (_hasDefinedSlotTemplate = 1); ` );                   // 判断是否有明文传入插槽模板（如果没有，多数是使用单一的默认插槽）
            }
            slots.forEach(slotNm => {
                arySrc.push( `     vn.a.slot === '${slotNm}' && (${SlotVnodes}_${hash(slotNm)} = vn.c || []); ` );  // 插槽名称一致时，复制相应插槽模板
            });
            arySrc.push( `     } ` );
            arySrc.push( ` }); ` );
            if ( isNoNameSlot ) {
                // 单一插槽，且无插槽名称，如果没特定模板则默认使用子节点
                arySrc.push( ` !_hasDefinedSlotTemplate && !${SlotVnodes}_${hash('')}.length && (${SlotVnodes}_${hash('')} = $state.$SLOT || []); ` );
            }


            root.walk( 'View', (nd) => {
                let type = options.TypeCodeBlock;
                let value =  arySrc.join('\n');
                nd.addChild( this.createNode({type, value}), 0 );   // 根节点前插入代码块节点
                return false;
            });

        }

    });

}());



/*
    let slotVnodes_xxxxx = [], slotVnodes_nnnnn = [];
    ($state.$SLOT || []).forEach(vn => {
        if (vn.a) {
            vn.a.slot === "xxx" && (slotVnodes_xxxxx = vn.c || []);
            vn.a.slot === "nnn" && (slotVnodes_nnnnn = vn.c || []);
        }
    });
*/

/*
    let _hasDefinedSlotTemplate, slotVnodes_15ed = [];
    ($state.$SLOT || []).forEach(vn => {
        if (vn.a) {
            vn.a.slot !== undefined && (_hasDefinedSlotTemplate = 1);
            vn.a.slot === "" && (slotVnodes_15ed = vn.c || []);
        }
    });
    !_hasDefinedSlotTemplate && !slotVnodes_15ed.length && (slotVnodes_15ed = $state.$SLOT || []);
*/

