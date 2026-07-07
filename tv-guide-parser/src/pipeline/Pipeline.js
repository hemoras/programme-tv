export default class Pipeline {

    constructor() {

        this.steps = [];

    }

    add(step) {

        this.steps.push(step);

        return this;

    }

    async execute(context) {

        for (const step of this.steps) {

            const start = performance.now();

            await step.execute(context);

            const end = performance.now();

            context.timings[step.name] = Math.round(end - start);

        }

        return context;

    }

}