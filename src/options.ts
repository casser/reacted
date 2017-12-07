import { Component } from "./component";
import { defer } from './constants'
import {PreactElement} from "./vnode";

export const options = {
	syncComponentUpdates: true,
	debounceRendering: defer,
	event(e:any){},
    onElementCreated(element: PreactElement) { },
	afterMount(component: Component) { },
	afterUpdate(component: Component) { },
	beforeUnmount(component: Component) { },
};
