import { Transform, TransformCallback } from "stream";

export default class HttpHeadersTransform extends Transform {
    readonly chats = [0x0d, 0x0a, 0x0d, 0x0a];
    private flag = 0;
    private buffers: Buffer[] = [];
    private firstTransform(buffer: Buffer): void {
        const chats = this.chats;
        for (let index = 0; index < buffer.length; index++) {
            const value = buffer[index];
            if (value === chats[this.flag]) {
                this.flag++;
                if (this.flag === chats.length) {
                    index++;
                    this.buffers.push(buffer.subarray(0, index));
                    const headersBuffer = Buffer.concat(this.buffers);
                    this.buffers = [];
                    this.push(headersBuffer);
                    this.push(buffer.subarray(index));
                    return;
                }
            } else {
                this.flag = 0;
            }
        }
    }
    _transform(buffer: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        // console.log('HttpTransform start');
        if (this.flag < this.chats.length) {
            this.firstTransform(buffer);
        } else {
            this.push(buffer);
        }
        callback();
        // console.log('HttpTransform end');
    }
}
