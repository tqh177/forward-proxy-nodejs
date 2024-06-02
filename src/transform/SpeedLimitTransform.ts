import { Transform, TransformCallback } from "stream";

export default class SpeedLimitTransform extends Transform {
    private lastLen = 0;
    private t = setInterval(()=>{
        if (this.lastLen===0) {
            return;
        }
        this.lastLen = 0;
    }, 1000);
    private limit = -1;
    private p = Promise.resolve();
    setLimit(limit: number){
        this.limit  = limit;
        return this;
    }
    // 使用promise链延迟数据推送
    private waitPush(chunk: Buffer){
        this.p = this.p.then(()=>{
            if(!this.writable){
                return;
            }
            this.lastLen+=chunk.length;
            this.push(chunk);
            const delay = this.lastLen/this.limit;
            if (delay<=1) {
                if(this.isPaused()){
                    this.resume();
                    // console.log('resume');
                }
                return;
            }
            return new Promise<void>((res)=>{
                if (!this.isPaused()) {
                    this.pause();
                    // console.log('pause');
                }
                setTimeout(() => {
                    res();
                }, (delay-1)*1000);
            });
        });
    }
    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        if (this.limit===-1) {
            this.push(chunk);
        } else if (this.limit===0) {
            this.destroy();
            return;
        } else {
            this.waitPush(chunk);
        }
        callback();
    }
    _destroy(error: Error | null, callback: (error?: Error | null | undefined) => void): void {
        callback(error);
        clearInterval(this.t);
    }
}
