class HahmostudioMicrophone extends AudioWorkletProcessor {
 constructor(){super();this.recording=false;this.epoch=0;this.startFrame=0;this.legacy=false;this.port.onmessage=e=>{
  const value=e.data;
  if(value===true||value===false){this.legacy=true;this.recording=value;return;}
  if(value?.type==='begin'&&Number.isInteger(value.epoch)&&Number.isInteger(value.frame)&&value.frame>=0){this.epoch=value.epoch;this.startFrame=value.frame;this.legacy=false;this.recording=true;}
  if(value?.type==='end'&&value.epoch===this.epoch){this.recording=false;this.port.postMessage({type:'stopped',epoch:this.epoch});}
 };}
 process(inputs){const channel=inputs[0]?.[0];if(channel&&this.recording){if(this.legacy)this.port.postMessage(new Float32Array(channel));else{const skip=Math.max(0,this.startFrame-currentFrame);if(skip<channel.length)this.port.postMessage({type:'samples',epoch:this.epoch,frame:currentFrame+skip,samples:new Float32Array(channel.subarray(skip))});}}return true;}
}
registerProcessor('hahmostudio-mic',HahmostudioMicrophone);
