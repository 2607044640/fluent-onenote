declare module "*.svelte" {
    import type { SvelteComponent } from "svelte";
    const component: typeof SvelteComponent;
    export default component;
}

declare module "*.css" {
    const content: string;
    export default content;
}
