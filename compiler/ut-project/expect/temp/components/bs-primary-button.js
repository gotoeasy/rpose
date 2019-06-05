// --------------------------------------------------------------------------------------
// 组件 BsPrimaryButton
// 注:应通过rpose.newComponentProxy方法创建组件代理对象后使用，而不是直接创建
// --------------------------------------------------------------------------------------
class BsPrimaryButton {
    // 简化的使用一个私有属性存放内部数据
    #private = {
        // 可通过标签配置的属性，未定义则不支持外部配置
        optionkeys: ["onclick", "type", "style"],

        // 可更新的state属性，未定义则不支持外部更新state
        statekeys: ["disabled", "$SLOT"],

        // 组件默认选项值
        options: {
            type: "primary"
        },
        // 组件默认数据状态值
        state: {}
    };

    // 构造方法
    constructor(options = {}) {
        rpose.extend(this.#private.options, options, this.#private.optionkeys); // 保存属性（按克隆方式复制以避免外部修改影响）

        rpose.extend(this.#private.state, options, this.#private.statekeys); // 保存数据（按克隆方式复制以避免外部修改影响）

        this.render = this.render.bind(this);
    }

    // 取得组件对象的数据状态副本
    getState() {
        return rpose.extend({}, this.#private.state, this.#private.statekeys); // 取得克隆的数据状态副本以避免外部修改影响
    }
    setState(state) {
        rpose.extend(this.#private.state, state, this.#private.statekeys); // 先保存数据（按克隆方式复制以避免外部修改影响）
        this.render(state); // 再渲染视图
    }

    // 默认渲染方法
    render(state) {
        let el,
            $$el,
            vnode,
            $this = this,
            $private = this.#private;

        // 首次渲染
        if (!$private.rendered) {
            vnode = $this.vnodeTemplate($private.state, $private.options); // 生成节点信息数据用于组件渲染
            el = rpose.createDom(vnode, $this);
            if (el && el.nodeType == 1) {
                $$(el).addClass($this.$COMPONENT_ID);
            }
            $private.rendered = true;
            return el;
        }

        // 再次渲染
        $$el = $$("." + $this.$COMPONENT_ID);
        if (!$$el.length) {
            console.warn("dom node missing"); // 组件根节点丢失无法再次渲染
        }

        vnode = $this.vnodeTemplate($private.state, $private.options); // 生成新的虚拟节点数据
        rpose.diffRender($this, vnode); // 差异渲染

        return $$el[0];
    }

    // 虚拟节点数据
    vnodeTemplate($state, $options) {
        let disabled = $state.disabled;
        let style = $options.style;
        let type = $options.type;
        let onclick = $options.onclick;
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
    }
}
