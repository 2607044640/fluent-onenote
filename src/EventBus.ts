/**
 * EventBus.ts
 * Typed publish/subscribe event system for cross-view communication.
 *
 * Architecture:
 *   Sidebar --[CATEGORY_SELECTED]--> MainView
 *   MainView --[TASK_SELECTED]-----> DetailView
 *   DetailView --[TASK_UPDATED]----> MainView (refresh list)
 *   Any view --[TASK_MOVED]--------> All views (refresh)
 *
 * Usage:
 *   EventBus.on(EventName.CATEGORY_SELECTED, (payload) => { ... });
 *   EventBus.emit(EventName.CATEGORY_SELECTED, { category });
 *   EventBus.off(EventName.CATEGORY_SELECTED, handler); // cleanup in onDestroy
 */

type EventHandler = (payload: any) => void;

class EventBusImpl {
    private listeners: Map<string, Set<EventHandler>> = new Map();

    /**
     * Subscribe to an event. Returns the handler for easy cleanup.
     */
    on(event: string, handler: EventHandler): EventHandler {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
        return handler;
    }

    /**
     * Unsubscribe a specific handler from an event.
     */
    off(event: string, handler: EventHandler): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Emit an event with a payload. All registered handlers are invoked synchronously.
     */
    emit(event: string, payload?: any): void {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(payload);
                } catch (e) {
                    console.error(`[EventBus] Error in handler for "${event}":`, e);
                }
            });
        }
    }

    /**
     * Remove ALL listeners. Called on plugin unload to prevent memory leaks.
     */
    destroy(): void {
        this.listeners.clear();
    }
}

/** Global singleton — shared across all views within the plugin lifecycle */
export const EventBus = new EventBusImpl();
