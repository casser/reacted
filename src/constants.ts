// render modes
export const NO_RENDER = 0;
export const SYNC_RENDER = 1;
export const FORCE_RENDER = 2;
export const ASYNC_RENDER = 3;
//
export const ATTR_KEY = Symbol('attributes');
export const COMPONENT = Symbol('Component');
export const COMPONENT_CLASS = Symbol('ComponentClass');
export const COMPONENT_NAME = Symbol('ComponentName');
export const COMPONENT_EVENTS = Symbol('ComponentEvents');
export const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;
export const defer = typeof Promise=='function' ? Promise.resolve().then.bind(Promise.resolve()) : setTimeout;
