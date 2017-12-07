import { options } from './options';
import { defer } from './constants';

import { Component } from './component';

export class RenderQueue {
    private items: Component[];

    public renderComponent:(c:Component,force?:number)=>void;

    constructor(renderer:(c:Component)=>void) {
        this.items = [];
        this.render = this.render.bind(this, renderer);
        this.renderComponent = renderer;
    }

    add(component: Component){
        if (!component._dirty && (component._dirty = true) && this.items.push(component) == 1) {
            (options.debounceRendering || defer)(this.render);
        }
    }

    render() {
        const list = this.items;
        this.items = [];
        let p;
        while ((p = list.pop())) {
            if (p._dirty) {
                this.renderComponent(p);
            }
        }
    }
}