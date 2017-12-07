import {Component} from "./component";

export type AnyComponent<P, S> = FunctionalComponent<P> | ComponentConstructor<P, S>;

export interface Dictionary<T=any> {
    [key: string]: T
}
export interface ComponentProps<C extends Component<any, any> | FunctionalComponent<any>> {
    children?: JSX.Element[];
    key?: string | number | any;
    ref?: (el: C) => void;
}
export interface ComponentConstructor<P, S> {
    new(props?: P, context?: any): Component<P, S>;
}
export interface FunctionalComponent<P> {
    (props?: P & ComponentProps<this>, context?: any): JSX.Element;
    displayName?: string;
    defaultProps?: any;
}


