export default class Channel {

    constructor(config) {
        this.name = config.name;
        this.config = config;
        this.programs = [];
    }

}