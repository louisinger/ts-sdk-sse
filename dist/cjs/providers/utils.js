"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventSourceIterator = eventSourceIterator;
function eventSourceIterator(eventSource) {
    const messageQueue = [];
    const errorQueue = [];
    let messageResolve = null;
    let errorResolve = null;
    const messageHandler = (event) => {
        if (messageResolve) {
            messageResolve({ value: event, done: false });
            messageResolve = null;
        }
        else {
            messageQueue.push(event);
        }
    };
    const errorHandler = () => {
        const error = new Error("EventSource error");
        if (errorResolve) {
            errorResolve({ value: error, done: false });
            errorResolve = null;
        }
        else {
            errorQueue.push(error);
        }
    };
    eventSource.addEventListener("message", messageHandler);
    eventSource.addEventListener("error", errorHandler);
    return {
        [Symbol.asyncIterator]() {
            return this;
        },
        async next() {
            // if we have queued messages, return the first one, remove it from the queue
            if (messageQueue.length > 0) {
                const event = messageQueue.shift();
                return { value: event, done: false };
            }
            // if we have queued errors, throw the first one, remove it from the queue
            if (errorQueue.length > 0) {
                const error = errorQueue.shift();
                throw error;
            }
            // wait for the next message or error
            return new Promise((resolve, reject) => {
                messageResolve = resolve;
                errorResolve = reject;
            }).finally(() => {
                messageResolve = null;
                errorResolve = null;
            });
        },
        return() {
            // clean up
            eventSource.removeEventListener("message", messageHandler);
            eventSource.removeEventListener("error", errorHandler);
            return Promise.resolve({ value: undefined, done: true });
        },
    };
}
