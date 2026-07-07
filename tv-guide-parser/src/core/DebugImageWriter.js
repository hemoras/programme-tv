import fs from "fs-extra";

export default class DebugImageWriter{

    static ensure(){

        fs.ensureDirSync("debug");

    }

}