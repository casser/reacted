import {FORCE_RENDER} from './constants';
import {queue} from './render';

export interface FunctionalComponent<P> {
    (props?: P & ComponentProps<this>, context?: any): JSX.Element;
    displayName?: string;
    defaultProps?: any;
}
export interface ComponentProps<C extends Component<any, any> | FunctionalComponent<any>> {
    children?: (JSX.Element | string)[] | JSX.Element | string;
    key?: string | number | any;
    ref?: (el: C) => void;
}

export abstract class Component<P={}, S={}> {
    public _disable: boolean;
    public _parentComponent?: Component<any, any>;
    public _component?: Component<any, any>;
    public _dirty: boolean;
    public __key: boolean;
    public __ref: (component:Component)=>void;
    public _renderCallbacks: Function[];

    public context: any;
    public base: Node;
    public state: S;
    public props: P & ComponentProps<this>;

    public prevProps?: P;
    public prevState?: S;
    public prevContext?: any;
    public nextBase?: Node;

    public getChildContext: () => any;

    constructor(props?: P, context?: any) {
        this._dirty = true;
        this.context = context;
        this.props = props as P;
        this.state = this.state || {} as S;
    }

    static displayName?: string;
    static defaultProps?: any;


    linkState: (name: string) => (event: Event) => void;

    /**
     * Update component state by copying properties from `state` to `this.state`.
     *    @param {object} state        A hash of state properties to update with new values
     *    @param {function} callback    A function to be called once component state is updated
     */
    setState<K extends keyof S>(state: (((prev: S, props: P | void) => Pick<S, K>) | Pick<S, K>), callback?: () => void): void {
        let s = this.state;
        if (!this.prevState) {
            this.prevState = Object.assign({}, s);
        }
        Object.assign(s, typeof state === 'function' ? state(s, this.props) : state);
        if (callback) {
            if (!this._renderCallbacks) {
                this._renderCallbacks = [];
            }
            this._renderCallbacks.push(callback);
        }
        queue.add(this);
    }

    forceUpdate(callback?: () => void): void {
        if (callback) {
            if (!this._renderCallbacks) {
                this._renderCallbacks = [];
            }
            this._renderCallbacks.push(callback);
        }
        queue.renderComponent(this, FORCE_RENDER);
    }


    componentWillMount?(): void;

    componentDidMount?(): void;

    componentWillUnmount?(): void;

    componentWillReceiveProps?(nextProps: P, nextContext: any): void;

    /**
     *  Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
     *    @param {object} nextProps
     *    @param {object} nextState
     *    @param {object} nextContext
     *    @returns {Boolean} should the component re-render
     *    @function
     */
    shouldComponentUpdate?(nextProps: P, nextState: S, nextContext: any): boolean;

    componentWillUpdate?(nextProps: P, nextState: S, nextContext: any): void;

    componentDidUpdate?(previousProps: P, previousState: S, previousContext: any): void;

    /** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
     *    Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
     *    @param {object} props        Props (eg: JSX attributes) received from parent element/component
     *    @param {object} state        The component's current state
     *    @param {object} context        Context object (if a parent component has provided context)
     *    @returns VNode
     */
    abstract render(props?: P & ComponentProps<this>, state?: S, context?: any): JSX.Element | null;
}

