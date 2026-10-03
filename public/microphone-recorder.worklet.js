class HahmostudioMicrophone extends AudioWorkletProcessor{constructor(){super();this.recording=false;this.port.onmessage=e=>{this.recording=e.data===true;};}process(inputs){const channel=inputs[0]?.[0];if(channel&&this.recording)this.port.postMessage(new Float32Array(channel));return true;}}
registerProcessor('hahmostudio-mic',HahmostudioMicrophone);
