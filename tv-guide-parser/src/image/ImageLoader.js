import sharp from "sharp";

import ImageInfo from "./ImageInfo.js";

export default class ImageLoader{

    async load(path){

        const metadata=await sharp(path).metadata();

        return new ImageInfo(

            path,

            metadata.width,

            metadata.height

        );

    }

}