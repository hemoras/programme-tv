import sharp from "sharp";

export default class ImageProcessor{

    async grayscale(input,output){

        await sharp(input)

            .grayscale()

            .toFile(output);

    }

}