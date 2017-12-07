import {RenderQueue} from "./render-queue";
import {
    ASYNC_RENDER,
    ATTR_KEY,
    FORCE_RENDER,
    IS_NON_DIMENSIONAL,
    NO_RENDER,
    SYNC_RENDER,
    COMPONENT,
    COMPONENT_CLASS,
    COMPONENT_NAME,
    COMPONENT_EVENTS,
} from "./constants";
import {options} from "./options";
import {Component} from "./component";
import {PreactElement} from "./vnode";
import {ComponentConstructor, Dictionary} from "./types";

export const queue = new RenderQueue(renderComponent);

let diffLevel = 0;
let isSvgMode = false;
let hydrating = false;
//
const mounts: any = [];
const components = {};

export function render(node: JSX.Element, parent?: Element | Document, merge?: Element): Node {
    return diff(merge, node, {}, false, parent, false);
}

//
function diff(node: Node, element: PreactElement, context: any, mountAll?: boolean, parent?: Node, componentRoot?: boolean) {
    // diffLevel having been 0 here indicates initial entry into the diff (not a sub diff)
    if (!diffLevel++) {
        // when first starting the diff, check if we're diffing an SVG or within an SVG
        isSvgMode = isSvgNode(parent);
        // hydration is indicated by the existing element to be diffed not having a prop cache
        hydrating = node != null && !(node[ATTR_KEY]);
    }

    let ret = internalDiff(node, element, context, mountAll, componentRoot);

    // append the element if its a new parent
    if (parent && ret.parentNode !== parent) {
        parent.appendChild(ret);
    }

    // diffLevel being reduced to 0 means we're exiting the diff
    if (!--diffLevel) {
        hydrating = false;
        // invoke queued componentDidMount lifecycle methods
        if (!componentRoot) {
            flushMounts();
        }
    }
    return ret;
}

function isSvgNode(el: Node): el is SVGElement {
    return ((el instanceof SVGElement) && el.ownerSVGElement !== undefined);
}

function isTextNode(el: Node): el is Text {
    return ((el instanceof Text) && el.splitText !== undefined);
}

function internalDiff(node: Node, element: PreactElement | Node | null | boolean | string | number, context: any, mountAll: boolean, componentRoot?: boolean): Node {
    let out = node;
    let prevSvgMode = isSvgMode;

    // empty values (null, undefined, booleans) render as empty Text nodes
    if (element == null || typeof element === 'boolean') {
        element = '';
    }


    // Fast case: Strings & Numbers create/update Text nodes.
    if (typeof element === 'string' || typeof element === 'number') {

        // update if it's already a Text element:
        if (isTextNode(node) && node.parentNode && (!node[COMPONENT] || componentRoot)) {
            /* istanbul ignore if */
            /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
            if (node.nodeValue != element) {
                node.nodeValue = String(element);
            }
        } else {
            // it wasn't a Text element: replace it with one and recycle the old Element
            out = document.createTextNode(element as string);
            if (node) {
                if (node.parentNode) {
                    node.parentNode.replaceChild(out, node);
                }
                recollectNodeTree(node, true);
            }
        }

        out[ATTR_KEY] = true;

        return out;
    }


    // If the VNode represents a Component, perform a component diff:
    let elementName = element.nodeName;
    if (typeof elementName === 'function') {
        return buildComponentFromVNode(node, element as PreactElement, context, mountAll);
    }

    // Tracks entering and exiting SVG namespace when descending through the tree.
    isSvgMode = elementName === 'svg' ? true : elementName === 'foreignObject' ? false : isSvgMode;


    // If there's no existing element or it's the wrong type, create a new one:
    elementName = String(elementName);
    if (!node || !isNamedNode(node, elementName)) {
        out = createNode(elementName, isSvgMode);
        if (node) {
            // move children into the replacement element
            while (node.firstChild) {
                out.appendChild(node.firstChild);
            }

            // if the previous Element was mounted into the DOM, replace it inline
            if (node.parentNode) {
                node.parentNode.replaceChild(out, node);
            }

            // recycle the old element (skips non-Element element types)
            recollectNodeTree(node, true);
        }
    }


    let fc = out.firstChild;
    let props = out[ATTR_KEY];
    let elementChildren = (element as PreactElement).children;

    if (props == null) {
        props = out[ATTR_KEY] = {};
        for (let a = out.attributes, i = a.length; i--;) {
            props[a[i].name] = a[i].value;
        }
    }

    // Optimization: fast-path for elements containing a single TextNode:
    let firstChild: string = elementChildren && elementChildren.length === 1 && typeof elementChildren[0] === 'string' ? elementChildren[0] as string : void 0;
    if (!hydrating && firstChild && fc != null && isTextNode(fc) && fc.nextSibling == null) {
        if (fc.nodeValue != firstChild) {
            fc.nodeValue = firstChild;
        }
    } else
    // otherwise, if there are existing or new children, diff them:
    if (elementChildren && elementChildren.length || fc != null) {
        innerDiffNode(out, elementChildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML != null);
    }

    // Apply attributes/props from VNode to the DOM Element:
    diffAttributes(out, element.attributes, props);

    // restore previous SVG mode: (in case we're exiting an SVG namespace)
    isSvgMode = prevSvgMode;

    return out;
}

function innerDiffNode(dom: Node, vchildren: any[], context: object, mountAll: boolean, isHydrating: boolean) {
    let originalChildren = dom.childNodes;
    let children = [];
    let keyed = {};
    let keyedLen = 0;
    let min = 0;
    let len = originalChildren.length;
    let childrenLen = 0;
    let vlen = vchildren ? vchildren.length : 0;
    let j, c, f, vchild, child;

    // Build up a map of keyed children and an Array of unkeyed children:
    if (len !== 0) {
        for (let i = 0; i < len; i++) {
            let child = originalChildren[i],
                props = child[ATTR_KEY],
                key = vlen && props ? child[COMPONENT] ? child[COMPONENT].__key : props.key : null;
            if (key != null) {
                keyedLen++;
                keyed[key] = child;
            }
            else if (props || (isTextNode(child) ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
                children[childrenLen++] = child;
            }
        }
    }

    if (vlen !== 0) {
        for (let i = 0; i < vlen; i++) {
            vchild = vchildren[i];
            child = null;

            // attempt to find a node based on key matching
            let key = vchild.key;
            if (key != null) {
                if (keyedLen && keyed[key] !== undefined) {
                    child = keyed[key];
                    keyed[key] = undefined;
                    keyedLen--;
                }
            } else
            // attempt to pluck a node of the same type from the existing children
            if (!child && min < childrenLen) {
                for (j = min; j < childrenLen; j++) {
                    if (children[j] !== undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
                        child = c;
                        children[j] = undefined;
                        if (j === childrenLen - 1) childrenLen--;
                        if (j === min) min++;
                        break;
                    }
                }
            }

            // morph the matched/found/created DOM child to match vchild (deep)
            child = internalDiff(child, vchild, context, mountAll);

            f = originalChildren[i];
            if (child && child !== dom && child !== f) {
                if (f == null) {
                    dom.appendChild(child);
                } else
                // child is next node
                if (child === f.nextSibling) {
                    removeNode(f);
                } else {
                    dom.insertBefore(child, f);
                }
            }
        }
    }


    // remove unused keyed children:
    if (keyedLen) {
        for (let i in keyed) {
            if (keyed[i] !== undefined) {
                recollectNodeTree(keyed[i], false);
            }
        }
    }

    // remove orphaned unkeyed children:
    while (min <= childrenLen) {
        if ((child = children[childrenLen--]) !== undefined) {
            recollectNodeTree(child, false);
        }
    }
}

function recollectNodeTree(node: Node, unmountOnly: boolean) {
    let component = node[COMPONENT];
    if (component) {
        // if node is owned by a Component, unmount that component (ends up recursing back here)
        unmountComponent(component);
    } else {
        // If the node's VNode had a ref function, invoke it with null here.
        // (this is part of the React spec, and smart for unsetting references)
        if (node[ATTR_KEY] != null && node[ATTR_KEY].ref) {
            node[ATTR_KEY].ref(null);
        }
        if (unmountOnly === false || node[ATTR_KEY] == null) {
            removeNode(node);
        }
        removeChildren(node);
    }
}

function removeChildren(node: Node) {
    node = node.lastChild;
    while (node) {
        let next = node.previousSibling;
        recollectNodeTree(node, true);
        node = next;
    }
}

function diffAttributes(dom: Node, attrs: any, old: any) {
    let name;

    // remove attributes no longer present on the vnode by setting them to undefined
    for (name in old) {
        if (!(attrs && attrs[name] != null) && old[name] != null) {
            setAccessor(dom as HTMLElement, name, old[name], old[name] = undefined, isSvgMode);
        }
    }

    // add new & update changed attributes
    for (name in attrs) {
        if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
            setAccessor(dom as HTMLElement, name, old[name], old[name] = attrs[name], isSvgMode);
        }
    }
}

function flushMounts() {
    let c;
    while ((c = mounts.pop())) {
        if (options.afterMount) options.afterMount(c);
        if (c.componentDidMount) c.componentDidMount();
    }
}

//
function renderComponent(component: Component, opts?: number, mountAll?: any, isChild?: any) {
    if (component._disable) {
        return;
    }

    let props = component.props,
        state = component.state,
        context = component.context,
        previousProps = component.prevProps || props,
        previousState = component.prevState || state,
        previousContext = component.prevContext || context,
        isUpdate = component.base,
        nextBase = component.nextBase,
        initialBase = isUpdate || nextBase,
        initialChildComponent = component._component,
        skip = false,
        rendered, inst, cbase;

    // if updating
    if (isUpdate) {
        component.props = previousProps;
        component.state = previousState;
        component.context = previousContext;
        if (opts !== FORCE_RENDER &&
            component.shouldComponentUpdate &&
            component.shouldComponentUpdate(props, state, context) === false
        ) {
            skip = true;
        } else if (component.componentWillUpdate) {
            component.componentWillUpdate(props, state, context);
        }
        component.props = props;
        component.state = state;
        component.context = context;
    }

    component.prevProps = component.prevState = component.prevContext = component.nextBase = null as any;
    component._dirty = false;

    if (!skip) {
        rendered = component.render(props, state, context);

        // context to pass to the child, can be updated via (grand-)parent component
        if (component.getChildContext) {
            context = Object.assign(Object.assign({}, context), component.getChildContext());
        }

        let childComponent = rendered && rendered.nodeName, toUnmount, base;
        if (typeof childComponent === 'function' && rendered) {
            // set up high order component link

            let childProps = getNodeProps(rendered);
            inst = initialChildComponent;

            if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
                setComponentProps(inst, childProps, SYNC_RENDER, context, false);
            }
            else {
                toUnmount = inst;

                component._component = inst = createComponent(childComponent, childProps, context);
                inst.nextBase = inst.nextBase || nextBase;
                inst._parentComponent = component;
                setComponentProps(inst, childProps, NO_RENDER, context, false);
                renderComponent(inst, SYNC_RENDER, mountAll, true);
            }

            base = inst.base;
        } else {
            cbase = initialBase;

            // destroy high order component link
            toUnmount = initialChildComponent;
            if (toUnmount) {
                cbase = component._component = void 0;
            }

            if (initialBase || opts === SYNC_RENDER) {
                if (cbase) {
                    cbase[COMPONENT] = void 0;
                }
                base = diff(cbase, rendered as any, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
            }
        }

        if (initialBase && base !== initialBase && inst !== initialChildComponent) {
            let baseParent = initialBase.parentNode;
            if (baseParent && base !== baseParent) {
                baseParent.replaceChild(base, initialBase);

                if (!toUnmount) {
                    initialBase[COMPONENT] = null;
                    recollectNodeTree(initialBase, false);
                }
            }
        }

        if (toUnmount) {
            unmountComponent(toUnmount);
        }

        component.base = base;
        if (base && !isChild) {
            let componentRef = component;
            let t: any = component;
            while ((t = t._parentComponent)) {
                (componentRef = t).base = base;
            }
            base[COMPONENT] = componentRef;
            base[COMPONENT_CLASS] = componentRef.constructor;
        }
    }

    if (!isUpdate || mountAll) {
        mounts.unshift(component);
    } else if (!skip) {
        // Ensure that pending componentDidMount() hooks of child components
        // are called before the componentDidUpdate() hook in the parent.
        // Note: disabled as it causes duplicate hooks, see https://github.com/developit/preact/issues/750
        // flushMounts();
        if (component.componentDidUpdate) {
            component.componentDidUpdate(previousProps, previousState, previousContext);
        }
        if (options.afterUpdate) {
            options.afterUpdate(component);
        }
    }

    if (component._renderCallbacks != null) {
        while (component._renderCallbacks.length) {
            const callback = component._renderCallbacks.pop();
            if (callback) {
                callback.call(component);
            }
        }
    }

    if (!diffLevel && !isChild) {
        flushMounts();
    }
}

function setComponentProps(component: Component, props: Dictionary, opts: number, context: object, mountAll: boolean) {
    if (component._disable) {
        return;
    }

    component._disable = true;

    if ((component.__ref = props.ref)) {
        delete props.ref;
    }
    if ((component.__key = props.key)) {
        delete props.key;
    }

    if (!component.base || mountAll) {
        if (component.componentWillMount) component.componentWillMount();
    } else
    // component has props receiver
    if (component.componentWillReceiveProps) {
        component.componentWillReceiveProps(props, context);
    }

    if (context && context !== component.context) {
        if (!component.prevContext) component.prevContext = component.context;
        component.context = context;
    }

    if (!component.prevProps) component.prevProps = component.props;
    component.props = props;

    component._disable = false;

    if (opts !== NO_RENDER) {
        if (opts === SYNC_RENDER || options.syncComponentUpdates !== false || !component.base) {
            renderComponent(component, SYNC_RENDER, mountAll);
        }
        else {
            queue.add(component);
        }
    }

    if (component.__ref) {
        component.__ref(component);
    }
}

function buildComponentFromVNode(dom: Node, element: PreactElement, context: any, mountAll: any) {
    let c = dom && dom[COMPONENT],
        originalComponent = c,
        oldDom = dom,
        isDirectOwner = c && dom[COMPONENT_CLASS] === element.nodeName,
        isOwner = isDirectOwner,
        props = getNodeProps(element);
    while (c && !isOwner && (c = c._parentComponent)) {
        isOwner = c.constructor === element.nodeName;
    }

    if (c && isOwner && (!mountAll || c[COMPONENT])) {
        setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
        dom = c.base;
    }
    else {
        if (originalComponent && !isDirectOwner) {
            unmountComponent(originalComponent);
            dom = oldDom = null;
        }

        c = createComponent(element.nodeName as Function, props, context);
        if (dom && !c.nextBase) {
            c.nextBase = dom;
            // passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
            oldDom = null;
        }
        setComponentProps(c, props, SYNC_RENDER, context, mountAll);
        dom = c.base;

        if (oldDom && dom !== oldDom) {
            oldDom[COMPONENT] = null;
            recollectNodeTree(oldDom, false);
        }
    }

    return dom;
}

function unmountComponent(component: Component) {
    if (options.beforeUnmount) {
        options.beforeUnmount(component);
    }

    let base = component.base;

    component._disable = true;

    if (component.componentWillUnmount) {
        component.componentWillUnmount();
    }

    component.base = null;

    // recursively tear down & recollect high-order component children:
    let inner = component._component;
    if (inner) {
        unmountComponent(inner);
    } else if (base) {
        if (base[ATTR_KEY] && base[ATTR_KEY].ref) base[ATTR_KEY].ref(null);

        component.nextBase = base;

        removeNode(base);
        collectComponent(component);

        removeChildren(base);
    }

    if (component.__ref) component.__ref(null);
}

function collectComponent(component: object) {
    let name = component.constructor.name;
    let comp = components[name];
    if (!comp) {
        comp = components[name] = []
    }
    comp.push(component);
}

function createComponent(Ctor: Function, props: object, context: any) {
    let list = components[Ctor.name];
    let inst = new (createComponentClass(Ctor))(props, context);
    if (list) {
        for (let i = list.length; i--;) {
            if (list[i].constructor === Ctor) {
                inst.nextBase = list[i].nextBase;
                list.splice(i, 1);
                break;
            }
        }
    }
    return inst;
}

function createComponentClass(Ctor: Function): ComponentConstructor<any, any> {
    let Comp: any;
    if (Ctor.prototype && Ctor.prototype instanceof Component) {
        Comp = Ctor
    } else {
        Comp = Ctor[COMPONENT_CLASS];
        if (!Comp) {
            Comp = class FunctionComponent extends Component<any, any> {
                render(props: any, state: any) {
                    return Ctor.call(this, props, state);
                }
            };
            Object.defineProperty(Ctor, COMPONENT_CLASS, {value: Comp});
        }
    }
    return Comp;
}

//
function createNode(nodeName: string, isSvg: boolean) {
    let node: any = isSvg
        ? document.createElementNS('http://www.w3.org/2000/svg', nodeName)
        : document.createElement(nodeName);
    node[COMPONENT_NAME] = nodeName;
    return node;
}

function removeNode(node: Node) {
    let parentNode = node.parentNode;
    if (parentNode) parentNode.removeChild(node);
}

function setAccessor(node: HTMLElement, name: any, old: any, value: any, isSvg: boolean) {
    if (name === 'className') name = 'class';
    if (name === 'key') {
        // ignore
    }
    else if (name === 'ref') {
        if (old) old(null);
        if (value) value(node);
    }
    else if (name === 'class' && !isSvg) {
        node.className = value || '';
    }
    else if (name === 'style') {
        if (!value || typeof value === 'string' || typeof old === 'string') {
            node.style.cssText = value || '';
        }
        if (value && typeof value === 'object') {
            if (typeof old !== 'string') {
                for (let i in old) if (!(i in value)) node.style[i] = '';
            }
            for (let i in value) {
                node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL.test(i) === false ? (value[i] + 'px') : value[i];
            }
        }
    }
    else if (name === 'dangerouslySetInnerHTML') {
        if (value) node.innerHTML = value.__html || '';
    }
    else if (name[0] == 'o' && name[1] == 'n') {
        let useCapture = name !== (name = name.replace(/Capture$/, ''));
        name = name.toLowerCase().substring(2);
        if (value) {
            if (!old) node.addEventListener(name, eventProxy, useCapture);
        }
        else {
            node.removeEventListener(name, eventProxy, useCapture);
        }
        (node[COMPONENT_EVENTS] || (node[COMPONENT_EVENTS] = {}))[name] = value;
    }
    else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
        setProperty(node, name, value == null ? '' : value);
        if (value == null || value === false) {
            node.removeAttribute(name);
        }
    }
    else {
        let ns = isSvg && (name !== (name = name.replace(/^xlink\:?/, '')));
        if (value == null || value === false) {
            if (ns) {
                node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());
            } else {
                node.removeAttribute(name);
            }
        }
        else if (typeof value !== 'function') {
            if (ns) {
                node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);
            } else {
                node.setAttribute(name, value);
            }
        }
    }
}

function setProperty(node: HTMLElement, name: any, value: any) {
    try {
        node[name] = value;
    } catch (e) {
    }
}

function eventProxy(this: HTMLElement, e: any) {
    return this[COMPONENT_EVENTS][e.type](options.event && options.event(e) || e);
}

function isSameNodeType(node: Node, vnode: PreactElement, hydrating: boolean) {
    if (typeof vnode === 'string' || typeof vnode === 'number') {
        return isTextNode(node);
    }
    if (typeof vnode.nodeName === 'string') {
        return !node[COMPONENT_CLASS] && isNamedNode(node, vnode.nodeName);
    }
    return hydrating || node[COMPONENT_CLASS] === vnode.nodeName;
}

function isNamedNode(node: Node, nodeName: string) {
    return node[COMPONENT_NAME] === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
}

function getNodeProps(vnode: PreactElement) {
    let props = Object.assign({}, vnode.attributes) as Dictionary;
    props.children = vnode.children;
    let defaultProps = (vnode.nodeName as any).defaultProps;
    if (defaultProps !== undefined) {
        for (let i in defaultProps) {
            if (props[i] === undefined) {
                props[i] = defaultProps[i];
            }
        }
    }
    return props;
}
