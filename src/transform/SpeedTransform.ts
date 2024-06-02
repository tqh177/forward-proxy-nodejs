import { stdin, stdout } from "process";
import { Transform, TransformCallback } from "stream";

let lastLen = 0;
export default class SpeedTransform extends Transform {
    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        lastLen += chunk.byteLength;
        this.push(chunk);
        callback();
    }
}

setInterval(() => {
    if (lastLen === 0) {
        return;
    }
    // console.log('Speed: ' + convertBytes(lastLen) + '/S');
    stdout.clearLine(0);
    stdout.write('\rSpeed: ' + convertBytes(lastLen) + '/S');
    lastLen = 0;
}, 1000);

function convertBytes(num: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;

    while (num >= 1024 && unitIndex < units.length - 1) {
        num /= 1024;
        unitIndex++;
    }

    return `${num.toFixed(1)} ${units[unitIndex]}`;
}
