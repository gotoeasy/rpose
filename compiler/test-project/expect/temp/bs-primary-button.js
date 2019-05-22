// ------------------------------------------------------------------------------------------------------
// 组件 BsPrimaryButton
// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接调用方法或用new创建
// ------------------------------------------------------------------------------------------------------

// 属性接口定义
BsPrimaryButton.prototype.$OPTION_KEYS = ["onclick", "type", "style"]; // 可通过标签配置的属性，未定义则不支持外部配置
BsPrimaryButton.prototype.$STATE_KEYS = ["disabled", "$SLOT"]; // 可更新的state属性，未定义则不支持外部更新state

// 组件函数
function BsPrimaryButton(options = {}) {
    // 组件默认选项值
    this.$options = {
        type: "primary"
    };
    rpose.extend(this.$options, options, this.$OPTION_KEYS); // 按属性接口克隆配置选项

    // 组件默认数据状态值
    this.$state = {};
    rpose.extend(this.$state, options, this.$STATE_KEYS); // 按属性接口克隆数据状态
}

/**
 * 节点模板函数
 */
BsPrimaryButton.prototype.nodeTemplate = function nodeTemplate($state, $options, $actions, $this) {
    let disabled = $state.disabled;
    let onclick = $options.onclick;
    let style = $options.style;
    let type = $options.type;
    let v_Array = [];
    let _hasDefinedSlotTemplate,
        slotVnodes_15ed = [];
    ($state.$SLOT || []).forEach(vn => {
        if (vn.a) {
            vn.a.slot !== undefined && (_hasDefinedSlotTemplate = 1);
            vn.a.slot === "" && (slotVnodes_15ed = vn.c || []);
        }
    });
    !_hasDefinedSlotTemplate && !slotVnodes_15ed.length && (slotVnodes_15ed = $state.$SLOT || []);
    v_Array.push({
        t: "button",
        r: 1,
        k: 1,
        c: (_Ary => {
            _Ary.push(...slotVnodes_15ed);
            return _Ary;
        })([]),
        a: {
            type: "button",
            disabled: disabled,
            style: style,
            class: {
                "btn-primary---bootstrap_1fmiufj": /primary/i.test(type),
                "btn---bootstrap_1fmiufj": 1,
                "btn-lg---bootstrap_1fmiufj": 1,
                "dropdown-toggle---bootstrap_1fmiufj": 1
            }
        },
        e: {
            click: onclick
        }
    });
    v_Array.length > 1 && console.warn("invlid tag count");
    return v_Array.length ? v_Array[0] : null;
};
