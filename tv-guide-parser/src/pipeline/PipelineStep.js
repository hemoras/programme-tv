export default class PipelineStep {

    constructor(name) {

        this.name = name;

    }

    async execute(context) {

        throw new Error(`${this.name}: execute() non implémentée`);

    }

}