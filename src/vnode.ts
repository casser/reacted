import {ComponentConstructor, FunctionalComponent} from "./types";
import {Dictionary} from "./types";
import {options} from './options';
import {AnyComponent} from "./types"

/** Virtual DOM Node */
export type PreactElementName<P=any, S=any> = ComponentConstructor<P, S> | FunctionalComponent<P> | string;
export type PreactElementChild<P=any, S=any> = PreactElement<P, S> | string;
export type PreactElementAttributes<P=any> = JSX.HTMLAttributes & P;


export class PreactElement<P=any, S=any> {

    readonly nodeName: PreactElementName<P, S>;
    readonly children: PreactElementChild<any, any>[];
    readonly attributes?: Dictionary;
    readonly key?: string;

    constructor(name: PreactElementName<P, S>, children: PreactElementChild<any, any>[], attributes?: Dictionary, key?: string) {
        this.nodeName = name;
        this.children = children;
        this.attributes = attributes == null ? void 0 : attributes;
        this.key = key || attributes == null ? void 0 : attributes.key;
    }
}


const stack: any[] = [];
const empty: any[] = [];

export function createElement<P>(node: string | AnyComponent<P, any>, attributes: PreactElementAttributes<P>, ...children: PreactElementChild<any,any>[]): JSX.Element
export function createElement<P>(node: string | AnyComponent<P, any>, attributes: PreactElementAttributes<P>): JSX.Element {
    let children: any[] = empty, lastSimple, child, simple, i;
    for (i = arguments.length; i-- > 2;) {
        stack.push(arguments[i]);
    }
    if (attributes && attributes.children != null) {
        if (!stack.length) {
            stack.push(attributes.children);
        }
        delete attributes.children;
    }
    while (stack.length) {
        if ((child = stack.pop()) && child.pop !== undefined) {
            for (i = child.length; i--;) stack.push(child[i]);
        } else {
            if (typeof child === 'boolean') {
                child = null
            }
            if ((simple = typeof node !== 'function')) {
                if (child == null) {
                    child = ''
                } else if (typeof child === 'number') {
                    child = String(child);
                }
                else if (typeof child !== 'string') {
                    simple = false;
                }
            }
            if (simple && lastSimple) {
                children[children.length - 1] += child;
            }
            else if (children === empty) {
                children = [child];
            }
            else {
                children.push(child);
            }

            lastSimple = simple;
        }
    }

    let p = new PreactElement(node,children,attributes);
    if (options.onElementCreated !== undefined) {
        options.onElementCreated(p);
    }

    return p;
}

export function cloneElement(element: JSX.Element, props: any): JSX.Element {
    return createElement (
        element.nodeName,
        Object.assign(Object.assign({}, element.attributes), props),
        arguments.length>2 ? [].slice.call(arguments, 2) : element.children
    );
}
